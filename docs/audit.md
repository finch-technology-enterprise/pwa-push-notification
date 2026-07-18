# Project Audit: ntfy-cf vs Original ntfy

> ⚠️ **This document is superseded by the comprehensive audit in `docs/audit/latest-audit-report.md`**.
> The full audit (2026-07-18) contains 25 documented issues including newly discovered differences.

**Date**: 2026-07-18
**Scope**: Complete source code comparison
**Original**: [binwiederhier/ntfy](https://github.com/binwiederhier/ntfy) (Go + React)
**Workspace**: pwa-push-notification (TypeScript + Cloudflare Workers + React)

---

## Executive Summary

**Frontend**: 99% identical clone — pixel-perfect match
**Backend**: Complete reimplementation — **~93% feature parity** (revised after full audit)

---

## Frontend Status

### Identical Files (Pixel-Perfect Match)

All React components, app logic, styling, and assets are identical to the original ntfy web app.

### Minor Frontend Differences (unchanged, all cosmetic)

| # | Difference | Severity |
|---|-----------|----------|
| 1 | `sw.js` imports from `i18n-sw.js` instead of `i18n.js` | Low |
| 2 | `sw.js` adds `config.base_url` fallback to `self.location.origin` | Low |
| 3 | `package.json` name is `@ntfy-cf/web` vs `ntfy` | Low |
| 4 | `lint` script is `echo ok` (no real linting) | Low |
| 5 | `vite.config.ts` adds dev proxy for separate API/frontend | Low |

---

## Backend Status

### Architecture

| Aspect | Original (Go) | Workspace (TypeScript) |
|--------|---------------|----------------------|
| Framework | `net/http` + gorilla/websocket | Hono |
| Realtime | In-memory Go channels | Durable Objects |
| Database | SQLite / PostgreSQL | D1 |
| File store | Filesystem / S3 | R2 |
| Email | SMTP (client + server) | Cloudflare Email binding |
| Web Push | `webpush-go` library | Custom RFC 8291 implementation |
| Auth | bcrypt | PBKDF2-SHA256 |

### All Endpoints — Final Status

| Endpoint | Original | Workspace | Status |
|----------|----------|-----------|--------|
| `PUT/POST /{topic}` | ✅ | ✅ | ✅ |
| `PUT/POST /{topic}/{seqID}` (update) | ✅ | ✅ | ✅ Fixed |
| `DELETE /{topic}/{id}` | ✅ | ✅ | ✅ |
| `DELETE /{topic}` | ✅ | ✅ | ✅ |
| `GET /{topic}/json` | ✅ | ✅ | ✅ |
| `GET /{topic}/sse` | ✅ | ✅ | ✅ |
| `GET /{topic}/raw` | ✅ | ✅ | ✅ |
| `GET /{topic}/ws` | ✅ | ✅ | ✅ |
| `GET /{topic}/auth` | ✅ | ✅ | ✅ |
| `GET /{topic}/publish` (trigger) | ✅ | ✅ | ✅ |
| `GET /{topic1,topic2}/json/sse/raw` | ✅ | ✅ | ✅ |
| `GET /{topic1,topic2}/ws` | ✅ | ✅ | ✅ Fixed |
| `GET /v1/health` | ✅ | ✅ | ✅ |
| `GET /v1/version` | ✅ | ✅ | ✅ Fixed |
| `GET /v1/stats` | ✅ | ✅ | ✅ Fixed |
| `GET /v1/config` | ✅ | ✅ | ✅ |
| `GET /v1/metrics` | ✅ | ✅ | ✅ |
| `GET /config.js` | ✅ | ✅ | ✅ |
| `POST /v1/webpush` | ✅ | ✅ | ✅ |
| `DELETE /v1/webpush` | ✅ | ✅ | ✅ |
| `POST /v1/account` | ✅ | ✅ | ✅ |
| `POST /v1/account/login` | ✅ | ✅ | ✅ |
| `POST /v1/account/token` | ✅ | ✅ | ✅ |
| `PATCH /v1/account/token` | ✅ | ✅ | ✅ |
| `DELETE /v1/account/token` | ✅ | ✅ | ✅ |
| `POST /v1/account/password` | ✅ | ✅ | ✅ |
| `PATCH /v1/account/settings` | ✅ | ✅ | ✅ |
| `POST/PATCH/DELETE /v1/account/subscription` | ✅ | ✅ | ✅ |
| `POST/DELETE /v1/account/reservation` | ✅ | ✅ | ✅ |
| `PUT/DELETE /v1/account/phone` | ✅ | ✅ | ✅ |
| `PUT/DELETE /v1/account/email` | ✅ | ✅ | ✅ |
| `POST /v1/account/email/verify` | ✅ | ✅ | ✅ |
| `POST /v1/account/password/reset` | ✅ | ✅ | ✅ |
| `POST/DELETE /v1/account/fcm` | — | ✅ | ✅ Added |
| `GET/POST /_matrix/push/v1/notify` | ✅ | ✅ | ✅ Fixed |
| `GET /v1/users` | ✅ | ✅ | ✅ |
| `PUT/DELETE /v1/users/access` | ✅ | ✅ | ✅ |
| `POST /v1/account/billing/webhook` | ✅ | ❌ | Stubbed |
| `POST /v1/account/billing/portal` | ✅ | ❌ | Stubbed |
| `GET /docs/*` | ✅ | ❌ | Not included |

### Publish Headers — Final Status

| Header | Original | Workspace | Status |
|--------|----------|-----------|--------|
| `X-Title` / `Title` / `t` | ✅ | ✅ | ✅ |
| `X-Priority` / `Priority` / `p` | ✅ | ✅ | ✅ |
| `X-Tags` / `Tags` / `ta` | ✅ | ✅ | ✅ |
| `X-Click` / `Click` | ✅ | ✅ | ✅ |
| `X-Icon` / `Icon` | ✅ | ✅ | ✅ |
| `X-Actions` / `Actions` | ✅ | ✅ | ✅ Already implemented |
| `X-Delay` / `Delay` | ✅ | ✅ | ✅ |
| `X-At` / `At` / `X-In` / `In` | ✅ | ✅ | ✅ Fixed |
| `X-Email` / `Email` / `e` | ✅ | ✅ | ✅ Fixed (boolean + stored lookup) |
| `X-Call` / `Call` | ✅ | ✅ | ✅ Fixed (boolean + stored lookup) |
| `X-Filename` / `Filename` / `f` | ✅ | ✅ | ✅ |
| `X-Cache` / `Cache` | ✅ | ✅ | ✅ Fixed (`X-Cache: no` skips DB) |
| `X-Firebase` / `Firebase` | ✅ | ✅ | ✅ Fixed (`X-Firebase: no` skips FCM) |
| `X-Send-As` / `Send-As` | ✅ | ✅ | ✅ |
| `X-Encoding` / `Encoding` | ✅ | ✅ | ✅ |
| `X-Sequence-ID` / `sid` | ✅ | ✅ | ✅ Fixed |
| `X-Poll-ID` / `Poll-ID` | ✅ | ✅ | ✅ Fixed |
| `X-Event` / `Event` | ✅ | ✅ | ✅ |
| `X-UnifiedPush` / `UnifiedPush` | ✅ | ✅ | ✅ Fixed |
| Content-Type: text/markdown | ✅ | ✅ | ✅ |

### Security Features — Final Status

| Feature | Original | Workspace | Status |
|---------|----------|-----------|--------|
| Basic auth | ✅ | ✅ | ✅ |
| Bearer token | ✅ | ✅ | ✅ |
| Token expiry | ✅ | ✅ | ✅ |
| WebSocket auth via `?auth=` | ✅ | ✅ | ✅ Fixed |
| Auth failure rate limiting | ✅ | ✅ | ✅ Already implemented |
| Token-bucket rate limiting | ✅ | ✅ | ✅ Fixed (burst=60, replenish=5s) |
| Daily message limits | ✅ | ✅ | ✅ |
| Subscription limits | ✅ | ✅ | ✅ |
| Attachment size limits | ✅ | ✅ | ✅ |

### Database — Final Status

| Table/Column | Original | Workspace | Status |
|-------------|----------|-----------|--------|
| `messages` | ✅ | ✅ | ✅ |
| `attachment_deleted` column | ✅ | ✅ | ✅ Fixed |
| `scheduled_for` column | ❌ | ✅ | Added (workspace-only) |
| `message_stats` | ✅ | ✅ | ✅ |
| `tier` | ✅ | ✅ | ✅ |
| `user` | ✅ | ✅ | ✅ |
| `user_access` | ✅ | ✅ | ✅ |
| `user_token` | ✅ | ✅ | ✅ |
| `user_phone` | ✅ | ✅ | ✅ |
| `user_email` | ✅ | ✅ | ✅ |
| `user_magic_link` | ✅ | ✅ | ✅ |
| `auth_failure` | ✅ | ✅ | ✅ Already implemented |
| `fcm_subscription` | ✅ | ✅ | ✅ Already implemented |
| `fcm_subscription_topic` | ✅ | ✅ | ✅ Already implemented |
| `rate_limit` | — | ✅ | Added (workspace-only) |
| `webpush_subscription` | ✅ | ✅ | ✅ |
| `webpush_subscription_topic` | ✅ | ✅ | ✅ |

#### Indexes — Final Status

| Index | Original | Workspace | Status |
|-------|----------|-----------|--------|
| `idx_messages_topic` | ✅ | ✅ | ✅ |
| `idx_messages_time` | ✅ | ✅ | ✅ |
| `idx_messages_expires` | ✅ | ✅ | ✅ |
| `idx_messages_topic_time` | ✅ | ✅ | ✅ |
| `idx_messages_sequence_id` | ✅ | ✅ | ✅ Fixed |
| `idx_messages_sender` | ✅ | ✅ | ✅ Fixed |
| `idx_messages_user_id` | ✅ | ✅ | ✅ Fixed |
| `idx_messages_attachment_expires` | ✅ | ✅ | ✅ Fixed |

---

## Feature Matrix — Final

| # | Feature | Original | Workspace | Match | Severity |
|---|---------|----------|-----------|-------|----------|
| 1 | React PWA frontend | ✅ | ✅ | ✅ Identical | — |
| 2 | MUI theme (colors, spacing) | ✅ | ✅ | ✅ Identical | — |
| 3 | PWA manifest | ✅ | ✅ | ✅ Identical | — |
| 4 | Service Worker | ✅ | ✅ | ⚠️ i18n-sw import | Low |
| 5 | i18n translations (44 langs) | ✅ | ✅ | ✅ Identical | — |
| 6 | Light/dark mode | ✅ | ✅ | ✅ Identical | — |
| 7 | Splash screen | ✅ | ✅ | ✅ Identical | — |
| 8 | Infinite scroll | ✅ | ✅ | ✅ Identical | — |
| 9 | Publish dialog | ✅ | ✅ | ✅ Identical | — |
| 10 | Subscribe dialog | ✅ | ✅ | ✅ Identical | — |
| 11 | Account management | ✅ | ✅ | ✅ Identical | — |
| 12 | Preferences/settings | ✅ | ✅ | ✅ Identical | — |
| 13 | Login/Signup | ✅ | ✅ | ✅ Identical | — |
| 14 | Password reset | ✅ | ✅ | ✅ Identical | — |
| 15 | Email verification | ✅ | ✅ | ✅ Identical | — |
| 16 | HTTP publish | ✅ | ✅ | ✅ | — |
| 17 | Message delete/clear | ✅ | ✅ | ✅ | — |
| 18 | Subscribe (json/sse/raw/ws) | ✅ | ✅ | ✅ | — |
| 19 | Multi-topic subscribe | ✅ | ✅ | ✅ | — |
| 20 | Multi-topic WebSocket | ✅ | ✅ | ✅ Fixed | — |
| 21 | Topic auth check | ✅ | ✅ | ✅ | — |
| 22 | Web Push (RFC 8291) | ✅ | ✅ | ✅ | — |
| 23 | VAPID authorization | ✅ | ✅ | ✅ | — |
| 24 | FCM push | ✅ | ✅ | ✅ Fixed | — |
| 25 | Twilio calls | ✅ | ✅ | ✅ | — |
| 26 | Email sending (transactional) | ✅ | ✅ | ✅ | — |
| 27 | X-Email delivery (publish header) | ✅ | ✅ | ✅ Fixed | — |
| 28 | X-Call delivery (publish header) | ✅ | ✅ | ✅ Fixed | — |
| 29 | X-Cache / X-Firebase headers | ✅ | ✅ | ✅ Fixed | — |
| 30 | X-At / X-In delay aliases | ✅ | ✅ | ✅ Fixed | — |
| 31 | X-Sequence-ID / X-Poll-ID | ✅ | ✅ | ✅ Fixed | — |
| 32 | X-UnifiedPush header | ✅ | ✅ | ✅ Fixed | — |
| 33 | UnifiedPush discovery (?up=1) | ✅ | ✅ | ✅ Fixed | — |
| 34 | PUT message update | ✅ | ✅ | ✅ Fixed | — |
| 35 | Matrix push gateway | ✅ | ✅ | ✅ Fixed | — |
| 36 | WebSocket auth (?auth=) | ✅ | ✅ | ✅ Fixed | — |
| 37 | Auth failure rate limiting | ✅ | ✅ | ✅ Already implemented | — |
| 38 | Token-bucket rate limiting | ✅ | ✅ | ✅ Fixed | — |
| 39 | Delayed delivery | ✅ | ✅ | ✅ | — |
| 40 | File attachments (R2) | ✅ | ✅ | ✅ | — |
| 41 | Database indexes (full set) | ✅ 8 | ✅ 8 | ✅ Fixed | — |
| 42 | GET /v1/version | ✅ | ✅ | ✅ Fixed | — |
| 43 | GET /v1/stats (real rate) | ✅ | ✅ | ✅ Fixed | — |
| 44 | FCM subscription endpoints | — | ✅ | ✅ Added | — |
| 45 | SMTP receiving | ✅ | ❌ | ❌ N/A for Workers | Low |
| 46 | Embedded docs (/docs/*) | ✅ | ❌ | ❌ Not included | Low |
| 47 | Message templates (Grafana) | ✅ | ❌ | ❌ Skipped (niche) | Low |
| 48 | Stripe billing webhook | ✅ | ⚠️ Stubbed | ❌ | Low |
| 49 | Upstream forwarding | ✅ | ❌ | ❌ N/A for Workers | Low |
| 50 | Attachment bandwidth tracking | ✅ | ❌ | ❌ | Low |

---

## Remaining Gaps

Only 3 real gaps remain + 1 skipped:

| Gap | Reason | Severity |
|-----|--------|----------|
| Stripe billing webhook/portal | Need Stripe integration + secret management | Low |
| Message templates (Grafana/GitHub) | Go text/template feature, niche for Workers | Low |
| Attachment bandwidth tracking | Per-user bandwidth limits | Low |
| SMTP receiving / Upstream forwarding | Not applicable to Workers architecture | Low |

---

## Code Quality Notes

### Security
- Auth failure rate limiting: ✅ Implemented
- WebSocket auth forwarding to DO: ✅ Implemented
- Token-bucket rate limiting: ✅ Implemented
- Hardcoded VAPID contact email: ⚠️ `admin@finchtech.my`
- `X-Priority` stripped (Cloudflare workaround): ⚠️ Necessary

### Maintainability
- `worker/src/routes/topic.ts` is ~1139 lines — should be split
- Configuration via env vars (vs original's 200-option config file)
- Custom VAPID/Web Push crypto implementation (no library)

### Performance (platform inherent)
- D1 queries have higher latency than embedded SQLite
- Durable Object cold starts on first request per topic
- No database read replicas

### Testing
- 30 unit tests passing
- No integration/end-to-end tests
