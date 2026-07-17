# ntfy-cf

A [Cloudflare](https://cloudflare.com)-native reimplementation of [ntfy](https://ntfy.sh) — a simple HTTP-based pub-sub push notification service.

Send push notifications to your phone or desktop via HTTP PUT/POST and subscribe via WebSocket, SSE, JSON stream, or Web Push. Runs entirely on Cloudflare's edge platform (Workers + D1 + Durable Objects + R2 + Pages).

> This project was fully vibe-coded with **DeepSeek V4 Flash** and **opencode**.

## Features

| Feature | Status |
|---------|--------|
| HTTP publish (`PUT`/`POST /{topic}`) | ✅ |
| Message update (`PUT /{topic}/{id}`) | ✅ |
| Subscribe via WebSocket (`/ws`) | ✅ |
| Subscribe via Server-Sent Events (`/sse`) | ✅ |
| Subscribe via JSON stream (`/json`) | ✅ |
| Subscribe via raw stream (`/raw`) | ✅ |
| Multi-topic subscribe (`/topic1,topic2/...`) | ✅ |
| Multi-topic WebSocket | ✅ |
| Long-polling (`?poll=`) | ✅ |
| Catch-up / history (`?since=`) | ✅ |
| Priority, tags, title, click, icon, actions | ✅ |
| Markdown content type | ✅ |
| X-Cache / X-Firebase disable headers | ✅ |
| X-At / X-In delay aliases | ✅ |
| X-Sequence-ID / X-Poll-ID / X-Event | ✅ |
| X-UnifiedPush support | ✅ |
| UnifiedPush discovery (`?up=1`) | ✅ |
| Authentication (Basic, Bearer, query param, WS) | ✅ |
| WebSocket auth via `?auth=` parameter | ✅ |
| Auth failure rate limiting (brute force protection) | ✅ |
| Token-bucket rate limiting (burst/replenish) | ✅ |
| Account sign-up, tokens, settings | ✅ |
| FCM subscription registration | ✅ |
| Admin API (user management, access control) | ✅ |
| Web Push notifications (VAPID + RFC 8291) | ✅ |
| File attachments (via R2) | ✅ |
| Email publishing (via Cloudflare Email, boolean `X-Email: true`) | ✅ |
| Phone call publishing (via Twilio, boolean `X-Call: true`) | ✅ |
| Scheduled/delayed delivery | ✅ |
| Firebase Cloud Messaging (FCM) | ✅ |
| Prometheus metrics (`/v1/metrics`) | ✅ |
| Matrix push gateway (`/_matrix/push/v1/notify`) | ✅ |
| PWA web app (React + Material UI, 99% identical to ntfy) | ✅ |
| Multi-language support (i18next, 44 languages) | ✅ |
| Offline-capable frontend (IndexedDB + SW) | ✅ |
| Light/dark/system theme | ✅ |
| Message actions (view URL, HTTP request, copy) | ✅ |
| Topic reservations & access control | ✅ |
| Billing/tier system (Stripe stubs) | ⚠️ Partial |
| SMTP email receiving | ❌ (N/A for Workers) |
| Message templates (Grafana, GitHub, etc.) | ❌ (niche, Go-specific) |

## Architecture

```
┌──────────────┐    ┌──────────────────────┐    ┌──────────────┐
│  HTTP Client  │───>│ Cloudflare Workers   │───>│ D1 Database  │
│  (publisher)  │    │ (Hono HTTP Router)   │    │ (persistence)│
└──────────────┘    │                      │    └──────────────┘
                    │  /v1/health          │
┌──────────────┐    │  /v1/config          │    ┌──────────────┐
│  Subscriber  │───>│  /v1/webpush         │───>│ Durable Obj  │
│  (WS/SSE/JS) │    │  /v1/account         │    │ (TopicDO)    │
└──────────────┘    │  /v1/users           │    │ (real-time)  │
                    │  /{topic}            │    └──────────────┘
┌──────────────┐    │                      │
│  Browser     │───>│                      │    ┌──────────────┐
│  (PWA)       │    └──────────────────────┘    │ R2 (files)   │
└──────────────┘                                │ Email/Twilio │
                                                └──────────────┘
```

- **API**: Cloudflare Worker running Hono HTTP framework
- **Real-time**: Durable Objects manage per-topic subscriptions (WebSocket, SSE, JSON stream, raw stream)
- **Database**: D1 (SQLite-compatible) for messages, users, tokens, subscriptions
- **Storage**: R2 for file attachments
- **Frontend**: React SPA deployed to Cloudflare Pages, fully PWA-capable
- **Push**: Web Push notifications with VAPID + RFC 8291 encryption, plus FCM for Android

## Quick Start

```bash
git clone <repo-url>
cd pwa-push-notification
npm install

# Set up VAPID keys
npx web-push generate-vapid-keys
# Add to .dev.vars:
#   WEB_PUSH_PUBLIC_KEY=<key>
#   WEB_PUSH_PRIVATE_KEY=<key>

# Create D1 database
wrangler d1 create ntfy-cf-db
# Update database_id in wrangler.toml

# Run both API + web app
npm run dev
```

- API: `http://localhost:8787`
- Web app: `http://localhost:3000`

## Configuration

| Env Variable | Default | Description |
|-------------|---------|-------------|
| `BASE_URL` | `http://localhost` | Public URL of the API |
| `ENABLE_SIGNUP` | `true` | Allow new user registration |
| `ENABLE_LOGIN` | `true` | Allow user login |
| `ENABLE_RESET_PASSWORD` | `false` | Enable password reset |
| `DISALLOWED_TOPICS` | (see code) | Blocked topic names |
| `WEB_PUSH_PUBLIC_KEY` | — | VAPID public key (required for Web Push) |
| `WEB_PUSH_PRIVATE_KEY` | — | VAPID private key (required for Web Push) |
| `FCM_SERVER_KEY` | — | Firebase Cloud Messaging server key |
| `TWILIO_ACCOUNT_SID` | — | Twilio account SID (for phone calls) |
| `TWILIO_AUTH_TOKEN` | — | Twilio auth token |
| `TWILIO_FROM_NUMBER` | — | Twilio phone number |
| `MESSAGE_SIZE_LIMIT` | `4096` | Max message body size in bytes |
| `ATTACHMENT_FILE_SIZE_LIMIT` | `10485760` | Max attachment file size (10 MB) |
| `ATTACHMENT_TOTAL_SIZE_LIMIT` | `104857600` | Max total attachment size (100 MB) |
| `KEEPALIVE_INTERVAL` | `30000` | Keepalive interval in ms |
| `VISITOR_SUBSCRIPTION_LIMIT` | `30` | Max Web Push subs per IP |
| `VISITOR_MESSAGE_DAILY_LIMIT` | `0` | Max messages per user per day (0 = unlimited) |

## Project Structure

```
├── worker/                   # Cloudflare Worker (API backend)
│   ├── src/
│   │   ├── index.ts          # Hono app entry, WS upgrade, static assets
│   │   ├── db.ts             # D1 schema & helpers
│   │   ├── types.ts          # TypeScript types
│   │   ├── middleware.ts     # Auth, password hashing, token/ID generation
│   │   ├── do/topic.ts       # Topic Durable Object (real-time pub/sub)
│   │   └── routes/
│   │       ├── health.ts     # /v1/health, /v1/version, /v1/stats
│   │       ├── config.ts     # /v1/config, /config.js
│   │       ├── metrics.ts    # /v1/metrics (Prometheus)
│   │       ├── topic.ts      # Publish/subscribe/delete/clear
│   │       ├── webpush.ts    # Web Push subscription registration
│   │       ├── account.ts    # Account signup/login/tokens/settings
│   │       ├── admin.ts      # User management & access control
│   │       ├── attachment.ts # File upload/download via R2
│   │       ├── billing.ts    # Tier listing & billing stubs
│   │       ├── cleanup.ts    # Cron-based expired message cleanup
│   │       ├── email.ts      # Email sending via Cloudflare Email
│   │       ├── fcm.ts        # Firebase Cloud Messaging
│   │       ├── call.ts       # Twilio phone calls
│   │       └── rateLimit.ts  # Rate limiting helpers
│   ├── migrations/
│   │   └── 0001_initial.sql  # SQL schema
│   ├── package.json
│   └── tsconfig.json
├── web/                      # React PWA frontend
│   ├── src/
│   │   ├── app/              # App logic (API client, connections, etc.)
│   │   └── components/       # React components
│   ├── public/
│   │   ├── sw.js            # Service worker (Workbox-based)
│   │   ├── manifest.webmanifest
│   │   └── static/          # CSS, fonts, images, i18n translations
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── packages/shared/          # Shared TypeScript types
├── wrangler.toml             # Worker configuration
├── tsconfig.json
└── package.json              # Root workspace config
```

## Deployment

```bash
# Deploy the API worker
npm run deploy:worker

# Deploy the web frontend
npm run deploy:web
```

## License

Apache License 2.0 — see [LICENSE](LICENSE).

Copyright (c) 2026 Finch Technology

This project is a derived work of [ntfy](https://github.com/binwiederhier/ntfy) by Philipp C. Heckel, licensed under Apache License 2.0.
