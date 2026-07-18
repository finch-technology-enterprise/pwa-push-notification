# Current Project Analysis: pwa-push-notification (ntfy-cf)

**Generated**: 2026-07-18
**Architecture**: Cloudflare Workers (TypeScript/Hono) + React PWA

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Cloudflare Workers                       │
│  ┌────────────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  Hono HTTP Router  │  │  Durable   │  │   Cron Triggers│  │
│  │  (worker/src/     │  │  Object    │  │  (cleanup)    │  │
│  │   index.ts)        │  │  (topic DO)│  │               │  │
│  └────────┬───────────┘  └─────┬──────┘  └───────────────┘  │
│           │                    │                              │
│  ┌────────┴────────────────────┴──────────────────────────┐  │
│  │                     Bindings                            │  │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌───────┐  ┌───────────┐ │  │
│  │  │ D1  │  │ R2  │  │ DO  │  │ Email │  │   Assets  │ │  │
│  │  │     │  │     │  │     │  │       │  │ (frontend)│ │  │
│  │  └─────┘  └─────┘  └─────┘  └───────┘  └───────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Key characteristics:**
- Serverless (no persistent processes)
- Durable Objects for stateful real-time pub/sub
- D1 (SQLite-compatible) for persistent storage
- R2 (S3-compatible) for file attachments
- Cloudflare Email for transactional email
- No incoming SMTP, no Stripe (stubbed)
- Custom Web Push RFC 8291 implementation (no library)

---

## 2. Worker Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 168 | Hono app entry, WebSocket upgrade, routes mounting, cron, static assets |
| `db.ts` | 346 | D1 schema init, migration v1→v5, DbMessage/DbUser/DbToken interfaces |
| `types.ts` | 79 | TypeScript types and constants |
| `middleware.ts` | 160 | Auth (Basic/Bearer), PBKDF2 hashing, token generation, sanitization |
| `do/topic.ts` | 495 | Topic Durable Object: WebSocket/SSE/JSON/raw streams, publish, broadcast, alarm for scheduled messages |
| `routes/account.ts` | 679 | Account CRUD, tokens, settings, subscriptions, reservations, phone, email, password reset, FCM |
| `routes/admin.ts` | 202 | User management + access control |
| `routes/attachment.ts` | 168 | R2 file upload/download |
| `routes/billing.ts` | 87 | Tier listing + Stripe stubs |
| `routes/call.ts` | 45 | Twilio phone call notifications |
| `routes/cleanup.ts` | 52 | Cron-based expired message/attachment/token cleanup |
| `routes/config.ts` | 108 | `/v1/config` JSON + `/config.js` script generation |
| `routes/email.ts` | 29 | Email sending via Cloudflare Email binding |
| `routes/fcm.ts` | 54 | Firebase Cloud Messaging sender |
| `routes/health.ts` | 51 | Health/version/stats endpoints |
| `routes/matrix.ts` | 77 | Matrix push gateway |
| `routes/metrics.ts` | 33 | Prometheus metrics handler |
| `routes/rateLimit.ts` | 141 | Token-bucket rate limiting + auth failure tracking |
| `routes/topic.ts` | 1164 | Publish/subscribe/delete/clear, multi-topic, Web Push encryption, VAPID, Twilio, email delivery |
| `routes/webpush.ts` | 101 | Web Push subscription registration/deletion |

---

## 3. Database Schema (D1)

**16 tables, 8 indexes** (defined in `worker/migrations/0001_initial.sql` + inline migrations):

| Table | Purpose | Differences from original |
|-------|---------|--------------------------|
| `messages` | Notification messages | Added `attachment_deleted`, `scheduled_for` columns |
| `message_stats` | Message counter (singleton) | Same |
| `tier` | Pricing tiers | Same |
| `user` | User accounts | Same |
| `user_access` | Topic access control | Same |
| `user_token` | API tokens | Same |
| `user_phone` | Phone numbers | Same |
| `user_email` | Email addresses | Same |
| `user_magic_link` | Magic link tokens | Same |
| `webpush_subscription` | Web Push subs | Same |
| `webpush_subscription_topic` | Web Push topic map | Same |
| `fcm_subscription` | FCM subs | Same |
| `fcm_subscription_topic` | FCM topic map | Same |
| `auth_failure` | Brute force tracking | Same |
| `rate_limit` | Token-bucket state | Workspace addition (not in original) |
| `schema_version` | Migration versioning | Workspace addition |

---

## 4. Durable Object (topic.ts)

The Topic DO replaces the original Go in-memory topic map:

- **State**: Subscriber set (WebSocket/SSE/JSON/raw connections), message history buffer, scheduled message alarm
- **Methods**: `publish()`, `addSubscriber()`, `removeSubscriber()`, `fetch()` (HTTP upgrade)
- **Lifecycle**: Created on first request to a topic, destroyed after inactivity
- **Limitations**:
  - 128 KB storage limit per DO (message buffer bounded)
  - Cold start on first request per topic (~50-500ms)
  - Single-threaded (all subscribers share one DO instance)
  - 30s CPU time per invocation (may affect long-lived publishes)

---

## 5. API Route Mapping

All routes mounted in `index.ts`:

```
POST/GET  /v1/health          → health.ts
GET       /v1/version         → health.ts
GET       /v1/stats           → health.ts
GET       /v1/config          → config.ts
GET       /config.js          → config.ts
GET       /v1/metrics         → metrics.ts
POST      /v1/webpush         → webpush.ts
DELETE    /v1/webpush         → webpush.ts
PUT       /v1/webpush         → ❌ NOT IMPLEMENTED
POST/GET  /v1/account/...     → account.ts
POST      /v1/account/login   → ❌ (uses /account/token instead)
POST/PATCH/DELETE /v1/account/token → account.ts
POST      /v1/account/password/reset/request → account.ts
POST      /v1/account/password/reset        → account.ts
GET/POST/PUT/DELETE /v1/users → admin.ts
PUT/DELETE /v1/users/access   → admin.ts
GET/POST  /_matrix/push/v1/notify → matrix.ts
GET       /v1/tiers           → billing.ts
POST      /v1/account/billing/* → billing.ts (stubs)
PUT/POST  /{topic}            → topic.ts
GET       /{topic}/json/sse/raw/ws → topic.ts (delegates to DO)
DELETE    /{topic}/{id}       → topic.ts
DELETE    /{topic}            → topic.ts
GET/PUT   /{topic}/{id}/clear → topic.ts
GET       /file/{id}          → attachment.ts
```

---

## 6. Authentication & Security

- **Basic Auth**: `Authorization: Basic base64(user:pass)` — supported
- **Bearer Token**: `Authorization: Bearer <token>` or query param — supported
- **Password hashing**: PBKDF2-SHA256 (vs original's bcrypt)
- **Token expiry**: Same model as original
- **Rate limiting**:
  - Token-bucket (burst=60, replenish=5s) — in `rateLimit.ts`
  - Daily message limits per tier
  - Auth failure tracking with exponential backoff
- **WebSocket auth**: Via `?auth=` query param forwarded to DO

---

## 7. Real-time Delivery

- **Durable Object per topic**: replaces original in-memory `map[string]*topic`
- **Subscriber management**: DO maintains subscriber set in memory
- **Publish flow**: Topic DO receives publish → stores in D1 → broadcasts to subscribers
- **Stream types**: WebSocket (raw), SSE (`text/event-stream`), JSON (NDJSON), raw text
- **Multi-topic subscribe**: One DO fetch can subscribe to multiple topics via comma-separated path
- **Keepalive**: DO `alarm` handler for scheduled delivery, client-side ping/pong for WS

---

## 8. Key Platform Differences (Workers vs Go)

| Aspect | Original (Go) | Current (Workers) | Impact |
|--------|---------------|-------------------|--------|
| Concurrency | Goroutines (true parallelism) | Single-threaded DO + isolate | Lower throughput per topic |
| Persistence | SQLite/PostgreSQL | D1 (per-query latency ~10-50ms) | Higher read/write latency |
| File storage | Filesystem/S3 | R2 (S3-compatible) | No bandwidth tracking |
| Email | SMTP client + server | Cloudflare Email binding | No incoming SMTP |
| Config | YAML file (~70 options) | Environment variables (~20 vars) | Less flexible |
| Deployment | Docker/systemd binary | `wrangler deploy` | Different operations |
| Versioning | Git tag releases | Continuous deploy | No versioned releases |
| Costs | Fixed server cost | Per-request pricing | Potentially higher at scale |
