# Architecture

## System Overview

ntfy-cf is a Cloudflare-native reimplementation of [ntfy](https://ntfy.sh) — a simple HTTP-based pub-sub push notification service. It uses five Cloudflare primitives:

| Component | Purpose |
|-----------|---------|
| **Cloudflare Workers** | HTTP API (Hono framework), request routing, business logic |
| **Durable Objects** | Per-topic real-time connection management & message broadcasting |
| **D1 Database** | Relational persistence for messages, users, subscriptions |
| **R2 Object Storage** | File attachment storage |
| **Cloudflare Pages** | React PWA frontend with service worker and offline support |

Additional integrations:
- **Cloudflare Email Binding** — transactional emails (verification, password reset)
- **Twilio** — phone call notifications
- **Firebase Cloud Messaging (FCM)** — Android push notifications

> This project was fully vibe-coded with **DeepSeek V4 Flash** and **opencode**.

## Comparison to Original ntfy

The original [ntfy](https://github.com/binwiederhier/ntfy) is a Go-based standalone server with embedded SQLite, optional PostgreSQL, and a React PWA frontend. This reimplementation replaces the Go backend entirely with Cloudflare Workers but keeps the frontend as a near-1:1 clone.

| Aspect | Original (Go) | ntfy-cf (Workers) |
|--------|---------------|-------------------|
| Runtime | Standalone binary | Cloudflare Workers (edge) |
| Real-time | In-memory Go topics + goroutines | Durable Objects |
| Database | SQLite / PostgreSQL | Cloudflare D1 |
| File store | Filesystem / S3 | Cloudflare R2 |
| Email | SMTP client + server | Cloudflare Email binding |
| Push | Firebase FCM + Web Push VAPID | FCM + Web Push VAPID |
| Phone | Twilio | Twilio |
| Frontend | React PWA (identical code) | React PWA (identical code) |

## Request Flow

```
                         ┌──────────────────────────┐
                         │   Cloudflare Workers      │
                         │   (Hono HTTP Router)      │
                         │                           │
                         │  /v1/health   ──> health  │
                         │  /v1/config   ──> config  │
                         │  /v1/metrics  ──> metrics │
                         │  /v1/webpush  ──> webpush │
                         │  /v1/account  ──> account │
                         │  /v1/users    ──> admin   │
                         │  /{topic}     ──> topic   │
                         └──────────┬────────────────┘
                                     │
                    ┌────────────────┼──────────────────┐
                    │                │                   │
                    ▼                ▼                   ▼
          ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
          │  D1 Database     │  │  Durable Obj │  │  Web Push    │
          │  (persistence)   │  │  TopicDO     │  │  (3rd-party  │
          │                  │  │  (real-time) │  │   endpoint)  │
          │  messages        │  │              │  └──────────────┘
          │  users           │  │  WebSocket   │
          │  tokens          │  │  SSE         │  ┌──────────────┐
          │  subscriptions   │  │  JSON stream │  │  R2 (files)  │
          └─────────────────┘  │  Raw stream  │  └──────────────┘
                                └──────────────┘
```

### Publish Flow

1. Client sends `PUT` or `POST` to `/{topic}` with plain text body and optional `X-*` headers
2. Worker validates topic format and checks disallowed topics list
3. Worker authenticates the request (optional; anonymous publish permitted)
4. Worker enforces daily message limit (if configured) and message size limit
5. If body exceeds size limit or `X-Filename` is set, body is stored as R2 attachment
6. Worker inserts the message into D1 with full metadata
7. Worker forwards the message to the TopicDO Durable Object for real-time broadcast
8. Worker sends Web Push notifications to subscribed browsers (VAPID + RFC 8291 encryption)
9. Worker sends FCM notifications for Android subscribers
10. Worker triggers Twilio phone call if `X-Call` is set
11. Returns `201 Created` with the message JSON

### Subscribe Flow

```
Client ──GET /{topic}/ws──> Worker ──fetch──> TopicDO ──WebSocket upgrade──> Client
Client ──GET /{topic}/sse──> Worker ──fetch──> TopicDO ──text/event-stream──> Client
Client ──GET /{topic}/json─> Worker ──fetch──> TopicDO ──application/x-ndjson─> Client
Client ──GET /{topic}/raw──> Worker ──fetch──> TopicDO ──text/plain──> Client
```

## Component Details

### Worker (`worker/src/index.ts`)

Uses the **Hono** framework for routing. Global middleware: CORS, request logging, secure headers.

Special handling:
- **WebSocket upgrades** are handled before Hono middleware to avoid corrupting 101 responses
- **Static assets** fall through to Cloudflare Pages binding for SPA routing
- **`Priority` header** (RFC 9218) is stripped to avoid Cloudflare edge 500 errors
- **Cron trigger** runs every hour for expired message/attachment cleanup

### Durable Object — TopicDO (`worker/src/do/topic.ts`)

One Durable Object instance per topic name (derived via `TOPIC_DO.idFromName(topic)`).

Responsibilities:
- Ring buffer of the last 100 messages per topic
- Managing persistent connections: WebSocket, SSE, JSON stream, raw stream
- Broadcasting published messages to all active subscribers
- Keepalive pings at configurable interval (default 30 s)
- Poll-based subscriptions with configurable timeout
- Scheduled message delivery via `alarm()` handler
- Cleaning up dead connections on disconnect

### Database (`worker/src/db.ts`)

- `initDatabase()` — runs schema migration on first request
- `getStats()` — returns aggregate message count
- `incrementMessages()` — atomically increments the message counter

Tables: `messages`, `message_stats`, `tier`, `user`, `user_access`, `user_token`, `user_phone`, `user_email`, `user_magic_link`, `webpush_subscription`, `webpush_subscription_topic`, `schema_version`.

### Middleware (`worker/src/middleware.ts`)

- **Authentication**: Basic auth (`username:password`), Bearer token, raw token (`nk...`), query param `?auth=`
- **Authorization**: `requireAuth()` / `requireAdmin()` guards
- **Password hashing**: PBKDF2-SHA256
- **Token generation**: random 64-char hex tokens
- **ID generation**: random 12-char alphanumeric, sortable sequence IDs
- **HTML sanitization**: prevents XSS in message content

### Web Frontend (`web/`)

React SPA built with Vite, Material UI 9, and `vite-plugin-pwa`. Near-identical clone of the original ntfy web app. Features:
- Topic subscription management with IndexedDB persistence (Dexie)
- Real-time message display via WebSocket/SSE/JSON stream
- Web Push subscription via Push API
- 44 language translations (i18next)
- Offline storage with IndexedDB
- Light/dark/system theme with flash prevention
- Service worker with Workbox precaching and push handling
- Configurable via dynamically generated `/config.js`

## Known Limitations vs Original ntfy

| Feature | Status | Reason |
|---------|--------|--------|
| SMTP email receiving | ❌ | Not applicable to Workers platform |
| Message templates (Grafana, etc.) | ❌ | Go text/template feature, niche for Workers |
| Stripe billing webhook/portal | ⚠️ Stubbed | Needs Stripe secret integration |
| Upstream forwarding | ❌ | N/A (this IS the upstream) |
| Attachment bandwidth tracking | ❌ | Not implemented |
