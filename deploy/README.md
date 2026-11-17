# Deploying to Oracle Cloud (Always Free)

One Always Free ARM VM runs Caddy (automatic HTTPS) and the app via Docker Compose. Postgres lives on Neon, so it is not part of the stack.

## Why this shape

WebhookRelay needs a single long-lived Node process: WebSocket relaying holds connections open, and the live trail pushes SSE events through an in-memory `EventEmitter`. That rules out Vercel and Lambda, and it means a second app instance would silently miss events. It also needs an always-on host, because free tiers that sleep when idle make webhook senders time out.

Free-tier terms change. Check Oracle's Always Free page before relying on the numbers below.

## 1. Create the VM

Console: Compute > Instances > Create instance.

- **Image**: Canonical Ubuntu 24.04 (aarch64).
- **Shape**: Ampere `VM.Standard.A1.Flex`, **2 OCPU / 12 GB**. Use only shapes labelled "Always Free-eligible".
- **Boot volume**: 50 GB.
- **Networking**: public subnet, assign a public IPv4.
- **SSH keys**: let Oracle generate a pair and download the private key, or paste your own public key.

"Out of capacity" is common. Retry later, try another availability domain, or try 1 OCPU / 6 GB.

## 2. Open ports 80 and 443 (two places)

1. **Cloud firewall**: instance > Subnet > Security List > Add ingress rules. Source `0.0.0.0/0`, TCP, destination ports `80` and `443`. Add UDP `443` too (HTTP/3).
2. **VM firewall** (Oracle's Ubuntu image ships restrictive rules):

   ```bash
   sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT -p udp --dport 443 -j ACCEPT
   sudo apt-get install -y iptables-persistent
   sudo netfilter-persistent save
   ```

Opening only one of the two is the usual reason Caddy cannot get a certificate.

## 3. DNS

Point an `A` record for your hostname at the VM's public IP. No domain? Use `<ip-with-dashes>.sslip.io` (for IP `1.2.3.4` that is `1-2-3-4.sslip.io`), which resolves for free.

## 4. Install Docker

```bash
ssh -i <private-key> ubuntu@<public-ip>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Log out and back in so the `docker` group applies.

## 5. Deploy

```bash
git clone <your-repo-url> webhookrelay && cd webhookrelay/deploy
cp .env.example .env
nano .env    # DOMAIN, DATABASE_URL (Neon direct string), JWT_SECRET
docker compose up -d --build
docker compose logs -f app
```

Generate the secret with `openssl rand -hex 32`. Migrations run automatically on every start. Then open `https://<DOMAIN>/register`.

If the repo is private, clone with a GitHub personal access token or add a read-only deploy key.

## Update

```bash
cd webhookrelay && git pull && cd deploy && docker compose up -d --build
```

## Neon notes

- **Use the direct connection string** (host without `-pooler`) plus `?sslmode=require`. `prisma migrate deploy` does not work through a pooler.
- **Region**: put the Neon project in the AWS region closest to your VM. Every relayed request runs several queries.
- **Cold starts**: the free tier suspends compute after about 5 idle minutes, so the first webhook after a quiet spell is slower. Enable "always return 200" on endpoints whose senders have tight timeouts.
- **Backups**: handled on Neon's side.

## Oracle gotchas

- **Idle reclamation**: Oracle may reclaim Always Free VMs with very low CPU, network and memory use. Upgrading the account to Pay-As-You-Go while staying within free limits is widely reported to prevent this. Verify against Oracle's current policy.
- **Home region** is permanent once chosen.

## Other hosts

Any Linux VM with Docker works with the same steps: skip the Oracle firewall step and open ports 80/443 however your provider does it. On a 1 GB machine, add a 2 GB swap file before building.
