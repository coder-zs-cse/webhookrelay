# Deploying to AWS (cheapest option)

One **Lightsail** instance runs everything with Docker Compose: Caddy (automatic HTTPS), the app, and Postgres.

## Why this shape

WebhookRelay needs a single long-lived Node process: WebSocket relaying holds connections open, and the live trail pushes SSE events through an in-memory `EventEmitter`. That rules out Lambda, and it means a second app instance would silently miss events.

| Option | Approx. monthly cost | Verdict |
|---|---|---|
| **Lightsail 1 GB + Postgres in Docker** | **~$7** (IPv4, disk and transfer included) | Chosen |
| EC2 `t4g.micro` + EBS + public IPv4 | ~$10 | Same box, more line items |
| App Runner + RDS | ~$20+ | Managed, but RDS alone costs more than the whole Lightsail box |
| ECS Fargate + ALB + RDS | ~$40+ | The ALB alone is ~$16 |

Prices are approximate. Check the Lightsail pricing page before you commit.

Trade-off: you own Postgres backups (see the end).

## One-time setup

1. **Lightsail**: create an instance, Linux/Unix, "OS only" Ubuntu 24.04, the **$7 / 1 GB** plan (512 MB is too tight for Next + Postgres + the build). Open ports 80 and 443 in its Networking tab. Allow SSH only from your IP.
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
# edit .env: set DOMAIN, then fill the two secrets:
#   openssl rand -hex 24   -> POSTGRES_PASSWORD
#   openssl rand -hex 32   -> JWT_SECRET
docker compose up -d --build
docker compose logs -f app
```

Migrations run automatically on every start. Then open `https://<your DOMAIN>/register`.

## Update

```bash
git pull && docker compose up -d --build
```

## Backups

Webhook logs are capped per endpoint, so the data worth keeping is small (users and endpoint mappings). A manual dump:

```bash
docker compose exec -T db pg_dump -U webhookrelay webhookrelay | gzip > backup-$(date +%F).sql.gz
```

For automatic safety, turn on Lightsail automatic snapshots (about $0.05 per GB-month of the 40 GB disk), or cron the dump above and copy it to S3.
