# Deploying to AWS (cheapest option)

One **Lightsail** instance runs Caddy (automatic HTTPS) and the app with Docker Compose. Postgres lives on Neon, so it is not part of the stack.

## Why this shape

WebhookRelay needs a single long-lived Node process: WebSocket relaying holds connections open, and the live trail pushes SSE events through an in-memory `EventEmitter`. That rules out Lambda, and it means a second app instance would silently miss events.

| Option | Approx. monthly cost | Verdict |
|---|---|---|
| **Lightsail 1 GB + Neon (free)** | **~$7** (IPv4, disk and transfer included) | Chosen |
| EC2 `t4g.micro` + EBS + public IPv4 | ~$10 | Same box, more line items |
| App Runner + Neon | ~$5-15 | Works, but billed for provisioned memory around the clock, and you still need a second tool for HTTPS and domain setup you get free here |
| ECS Fargate + ALB | ~$25+ | The ALB alone is ~$16 |

Prices are approximate. Check the Lightsail pricing page before you commit.

Memory: with Postgres gone, the $5 / 512 MB plan can run the app, but the Next build is tight even with swap. The 1 GB plan is the safe choice, and you can drop to $5 later if you build elsewhere.

## One-time setup

1. **Lightsail**: create an instance, Linux/Unix, "OS only" Ubuntu 24.04, the **$7 / 1 GB** plan (512 MB is too tight for the Next build). Open ports 80 and 443 in its Networking tab. Allow SSH only from your IP.
2. **Static IP**: Networking tab, create a static IP and attach it (free while attached).
3. **DNS**: point an `A` record for your hostname at that IP. No domain yet? Use `<ip-with-dashes>.sslip.io`, which resolves to the IP for free.
4. **SSH in** and install Docker plus a swap file (the Next build needs the headroom):

   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

   Log out and back in so the `docker` group applies.

## Deploy

```bash
git clone <your-repo> webhookrelay && cd webhookrelay/deploy
cp .env.example .env
# edit .env: set DOMAIN and DATABASE_URL (Neon direct string), then:
#   openssl rand -hex 32   -> JWT_SECRET
docker compose up -d --build
docker compose logs -f app
```

Migrations run automatically on every start. Then open `https://<your DOMAIN>/register`.

## Update

```bash
git pull && docker compose up -d --build
```

## Neon notes

- **Region**: create the Neon project in the AWS region closest to your Lightsail instance. Every relayed request does several queries (insert log, list, prune), so latency adds up.
- **Cold starts**: the free tier suspends compute after about 5 idle minutes, so the first webhook after a quiet spell pays a short wake-up delay. If a sender has a tight timeout, enable the "always return 200" option on that endpoint or upgrade the Neon plan.
- **Backups**: Neon keeps point-in-time history on its side, so you have nothing to run here.
