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

## Live Trail

The logs drawer includes a live trail mode powered by Server-Sent Events (SSE). When you open the logs for any endpoint, an SSE connection is established and incoming requests appear instantly — no manual refresh needed.
```
Webhook arrives
│
├──→ Saved to database
│
└──→ Pushed to in-memory EventEmitter
│
└──→ Streamed to respective SSE client listening to that relay 
│
└──→ Appears in your browser instantly
```

The connection status is shown in the toolbar — a green dot means you're receiving live updates. If the connection drops, the client retries with exponential backoff up to 5 times before giving up. A manual reconnect button appears if all retries are exhausted.

No database polling is involved. The server only hits the DB once (to save the log), then broadcasts to connected clients in-memory via a shared EventEmitter. Zero wasted queries.

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

**Note:** Live trail requires a persistent server process. It will not work on serverless platforms like Vercel, since SSE connections need to stay open and the in-memory EventEmitter must persist across requests.

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
6. Trigger a test event — watch it appear live in the logs drawer

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
│   │       └── mappings/   # CRUD + logs + SSE stream
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── MappingCard.tsx
│   │   ├── MappingModal.tsx
│   │   └── LogsDrawer.tsx  # Log viewer + live trail SSE client
│   ├── lib/
│   │   ├── prisma.ts       # Prisma singleton
│   │   ├── auth.ts         # JWT helpers (jose)
│   │   └── eventBus.ts     # Shared EventEmitter for SSE broadcasting
│   └── types/
│       └── index.ts
├── middleware.ts             # Route protection
└── .env.example
```
The main additions: a "Live Trail" section explaining how SSE works in the project with an ASCII diagram of the data flow, a deployment note about serverless incompatibility, eventBus.ts in the directory structure, and updated descriptions for files that were touched by the feature.
The connection status is shown in the toolbar — a green dot means you're receiving live updates. If the connection drops, the client retries with exponential backoff up to 5 times before giving up. A manual reconnect button appears if all retries are exhausted.

No database polling is involved. The server only hits the DB once (to save the log), then broadcasts to connected clients in-memory via a shared EventEmitter. Zero wasted queries.

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

<img width="1920" height="1080" alt="Screenshot (59)" src="https://github.com/user-attachments/assets/f5f6f9f1-8297-4ea6-a679-a3cacea85ca6" />
<img width="1920" height="1080" alt="Screenshot (60)" src="https://github.com/user-attachments/assets/03a90bb2-a5c4-4fb9-9bd6-d18a551b0380" />

