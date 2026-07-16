# ntfy-cf

A self-hosted, Cloudflare-native clone of [ntfy](https://ntfy.sh) — a simple HTTP-based pub-sub push notification service. Send push notifications to your phone or desktop via HTTP PUT/POST and subscribe via WebSocket, SSE, JSON stream, or Web Push.

## Features

| Feature | Status |
| ------- | ------ |
| HTTP publish (`PUT`/`POST /{topic}`) | ✅ |
| Subscribe via WebSocket (`/ws`) | ✅ |
| Subscribe via Server-Sent Events (`/sse`) | ✅ |
| Subscribe via JSON stream (`/json`) | ✅ |
| Subscribe via raw stream (`/raw`) | ✅ |
| Long-polling (`?poll=`) | ✅ |
| Catch-up / history (`?since=`) | ✅ |
| Priority, tags, title, click, icon, actions headers | ✅ |
| Markdown content type | ✅ |
| Authentication (Basic, Bearer token, query param) | ✅ |
| Account sign-up, tokens, settings | ✅ |
| Admin API (user management, access control) | ✅ |
| Web Push notifications (VAPID + RFC 8291 encryption) | ✅ |
| Prometheus metrics (`/v1/metrics`) | ✅ |
| PWA web app (React + Material UI) | ✅ |
| Multi-language support (i18next) | ✅ |
| Offline-capable front-end (IndexedDB + service worker) | ✅ |
| File attachments | ❌ |
| Email publishing | ❌ |
| Phone call publishing | ❌ |
| Scheduled delivery | ❌ |

## Architecture

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  HTTP Client  │───>│ Cloudflare      │───>│ D1 Database  │
│  (publisher)  │    │ Workers (Hono)  │    │ (persistence)│
└──────────────┘    │                 │    └──────────────┘
                    │                 │
┌──────────────┐    │  /v1/health     │    ┌──────────────┐
│  Subscriber  │───>│  /v1/config     │───>│ Durable Obj  │
│  (WS/SSE/JS) │    │  /v1/webpush    │    │ (TopicDO)    │
└──────────────┘    │  /v1/account    │    │ (real-time)  │
                    │  /v1/users      │    └──────────────┘
┌──────────────┐    │  /{topic}       │
│  Browser     │───>│                 │    ┌──────────────┐
│  (PWA)       │    └─────────────────┘    │ Cloudflare   │
│              │                           │ Pages (React)│
└──────────────┘                           └──────────────┘
```

- **API**: Cloudflare Worker running Hono HTTP framework
- **Real-time**: Durable Objects manage per-topic subscriptions (WebSocket, SSE, JSON stream, raw stream)
- **Database**: D1 (SQLite-compatible) for messages, users, tokens, subscriptions
- **Front-end**: React SPA deployed to Cloudflare Pages, fully PWA-capable
- **Push**: Web Push notifications with VAPID + RFC 8291 encryption layer

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A [Cloudflare account](https://dash.cloudflare.com/) with:
  - Workers subscription (paid or free)
  - D1 database quota
  - Pages subscription

## Local Development

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd pwa-push-notification
npm install
```

### 2. Configure environment

Copy or create `.dev.vars` in the project root with Web Push VAPID keys:

```
WEB_PUSH_PUBLIC_KEY=<your-vapid-public-key>
WEB_PUSH_PRIVATE_KEY=<your-vapid-private-key>
```

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

### 3. Create D1 database

```bash
wrangler d1 create ntfy-cf-db
```

Copy the database ID from the output and update `database_id` in `wrangler.toml`.

### 4. Run the API server

```bash
npm run dev:worker
```

The API starts at `http://localhost:8787`.

### 5. Run the web app

```bash
npm run dev:web
```

The web app starts at `http://localhost:3000` and proxies API requests to the worker.

### 6. Run both concurrently

```bash
npm run dev
```

### 7. Run tests

```bash
npm test
```

### 8. Lint

```bash
npm run lint
```

## Deployment

### Manual

```bash
# Deploy the API worker
npm run deploy:worker

# Deploy the web front-end
npm run deploy:web
```

### CI/CD

The repository includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that:

1. **Tests** on every push/PR to `main` — `npm ci`, `npm run build`, `npm test`
2. **Deploys the Worker** to Cloudflare Workers (on push to `main`)
3. **Deploys the web app** to Cloudflare Pages (on push to `main`)

Required GitHub Secrets:

| Secret | Description |
| ------ | ----------- |
| `CF_API_TOKEN` | Cloudflare API token with Workers + Pages permissions |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_WEB_PUSH_PUBLIC_KEY` | VAPID public key (optional for CI, required for push) |
| `CF_WEB_PUSH_PRIVATE_KEY` | VAPID private key (optional for CI, required for push) |

## Configuration

| Environment Variable | Default | Description |
| ------------------- | ------- | ----------- |
| `BASE_URL` | `http://localhost` | Public URL of the API |
| `ENABLE_SIGNUP` | `true` | Allow new user registration |
| `ENABLE_LOGIN` | `true` | Allow user login |
| `DISALLOWED_TOPICS` | (see code) | Comma-separated blocked topic names |
| `ACCESS_CONTROL_ALLOW_ORIGIN` | `*` | CORS origin |
| `VISITOR_SUBSCRIPTION_LIMIT` | `30` | Max Web Push subs per IP |
| `VISITOR_MESSAGE_DAILY_LIMIT` | `0` | Max messages per anonymous user per day (0 = unlimited) |
| `MESSAGE_SIZE_LIMIT` | `4096` | Max message body size in bytes |
| `KEEPALIVE_INTERVAL` | `45` | Keepalive interval in seconds |

## Project Structure

```
├── worker/              # Cloudflare Worker (API)
│   ├── src/
│   │   ├── index.ts     # Hono app entry point
│   │   ├── db.ts        # D1 schema & helpers
│   │   ├── types.ts     # TypeScript types
│   │   ├── middleware.ts # Auth, ID generation
│   │   ├── do/topic.ts  # Topic Durable Object
│   │   └── routes/      # Route handlers
│   │       ├── health.ts
│   │       ├── config.ts
│   │       ├── metrics.ts
│   │       ├── topic.ts
│   │       ├── webpush.ts
│   │       ├── account.ts
│   │       └── admin.ts
│   ├── package.json
│   └── tsconfig.json
├── web/                 # React PWA front-end
│   ├── src/
│   │   ├── app/         # App logic (API client, connections, etc.)
│   │   └── components/  # React components
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── packages/shared/     # Shared TypeScript types & utilities
├── migrations/          # SQL migrations
├── .github/workflows/   # CI/CD
├── wrangler.toml        # Worker config
├── tsconfig.json
└── package.json         # Root workspace config
```

## License

MIT — see [LICENSE](LICENSE).

Copyright (c) 2026 Finch Technology
