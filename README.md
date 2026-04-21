# WebhookRelay

A self-hosted webhook relay that gives you a stable production URL for forwarding HTTP requests to your local machine — no ngrok warnings, no certificate issues.

## Why?

Free ngrok tunnels show a browser warning page and sometimes fail certificate checks with services like Google RCS or Razorpay. WebhookRelay runs on your own domain with a real TLS certificate, acting as a transparent HTTP proxy.

## How it works

```
Razorpay / Stripe / Any service
        │
        ▼
https://yourdomain.com/r/razorpay-webhook   ← production URL (this app)
        │  (relay forwards full request)
        ▼
http://localhost:3000/api/webhook            ← your local machine
```

All request details (method, headers, body, query params) are forwarded as-is. The response from your local server is passed back to the caller.

## Features

- ✅ Relay GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS
- ✅ Multi-user — each user manages their own endpoints
- ✅ Create / edit / delete relay endpoints
- ✅ Pause/resume endpoints without deleting
- ✅ Per-endpoint request log retention (configurable, 1–100)
- ✅ Log viewer with method, status, headers, body, query params, duration
- ✅ One-click copy of the production URL

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database

### Installation

```bash
git clone <your-repo>
cd webhookrelay
pnpm install
```

### Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/webhookrelay"
JWT_SECRET="a-long-random-secret-string"
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"
```

`NEXT_PUBLIC_BASE_URL` is used to build the production URL shown in the dashboard. Set it to your deployment domain.

### Database Setup

```bash
pnpm prisma:migrate
```

### Run

```bash
pnpm dev          # development
pnpm build        # production build
pnpm start        # production server
```

## Deploying

Deploy to any Node.js host (Railway, Render, Fly.io, VPS with PM2). Make sure to:

1. Set all three environment variables
2. Set `NEXT_PUBLIC_BASE_URL` to your actual domain
3. Run `pnpm prisma:generate` before `pnpm build`

### Deployment script example

```bash
pnpm install
pnpm prisma:generate
pnpm prisma migrate deploy
pnpm build
pnpm start
```

## Usage

1. Register an account at `/register`
2. Create a relay endpoint — pick a slug like `razorpay-webhook`
3. Your production URL is `https://yourdomain.com/r/razorpay-webhook`
4. Set this URL in Razorpay / Stripe / any webhook config
5. Make sure your local server is running
6. Trigger a test event — view it in the logs drawer

## Directory Structure

```
├── prisma/
│   └── schema.prisma       # DB schema (User, Mapping, RequestLog)
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/      # Login page
│   │   │   └── register/   # Register page
│   │   ├── dashboard/      # Main dashboard
│   │   ├── r/[slug]/       # ← The relay handler (route.ts)
│   │   └── api/
│   │       ├── auth/       # login, register, logout, me
│   │       └── mappings/   # CRUD + logs
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── MappingCard.tsx
│   │   ├── MappingModal.tsx
│   │   └── LogsDrawer.tsx
│   ├── lib/
│   │   ├── prisma.ts       # Prisma singleton
│   │   └── auth.ts         # JWT helpers (jose)
│   └── types/
│       └── index.ts
├── middleware.ts             # Route protection
└── .env.example
```
