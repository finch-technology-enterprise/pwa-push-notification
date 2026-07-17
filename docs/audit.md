# Project Audit: ntfy-cf vs Original ntfy

**Date**: 2026-07-17
**Scope**: Complete source code comparison
**Original**: [binwiederhier/ntfy](https://github.com/binwiederhier/ntfy) (Go + React)
**Workspace**: pwa-push-notification (TypeScript + Cloudflare Workers + React)

---

## Executive Summary

**Frontend**: 99% identical clone — pixel-perfect match
**Backend**: Complete reimplementation in TypeScript for Cloudflare Workers — ~70% feature parity

---

## Frontend Status

### Identical Files (Pixel-Perfect Match)

All React components, app logic, styling, and assets are identical to the original ntfy web app:

| File | Original | Workspace | Status |
|------|----------|-----------|--------|
| `web/src/index.jsx` | ✅ | ✅ | Identical |
| `web/src/components/App.jsx` | 206 lines | 206 lines | Identical |
| `web/src/components/ActionBar.jsx` | 233 lines | 233 lines | Identical |
| `web/src/components/Navigation.jsx` | 457 lines | 457 lines | Identical |
| `web/src/components/Notifications.jsx` | 674 lines | 674 lines | Identical |
| `web/src/components/theme.js` | 81 lines | 81 lines | Identical |
| `web/src/components/styles.js` | 19 lines | 19 lines | Identical |
| `web/src/components/routes.js` | 23 lines | 23 lines | Identical |
| `web/src/components/Login.jsx` | 127 lines | 127 lines | Identical |
| `web/src/components/Signup.jsx` | 172 lines | 172 lines | Identical |
| `web/src/components/PublishDialog.jsx` | 980 lines | 980 lines | Identical |
| `web/src/components/SubscribeDialog.jsx` | 342 lines | 342 lines | Identical |
| `web/src/components/Prefs.jsx` | 858 lines | 858 lines | Identical |
| `web/src/components/Account.jsx` | 1423+ lines | 1423+ lines | Identical |
| `web/index.html` | 142 lines | 142 lines | Identical |
| `web/public/sw.js` | 459 lines | 459 lines | ⚠️ See below |
| `web/src/app/*.js` | All | All | Identical |

### Minor Frontend Differences

#### 1. Service Worker i18n Import (`web/public/sw.js`)
- **Original**: `import initI18n from "../src/app/i18n"`
- **Workspace**: `import initI18n from "../src/app/i18n-sw"`
- **Impact**: Workspace uses a separate i18n entry point without React dependency. Should be functionally equivalent but adds code duplication.

#### 2. Service Worker Base URL Fallback (`web/public/sw.js`)
- **Original**: No fallback — assumes Go server always sets `config.base_url`
- **Workspace**: Added `if (!config.base_url) config.base_url = self.location.origin;`
- **Impact**: Handles Cloudflare deployments where BASE_URL env var may be empty. Necessary platform adaptation.

#### 3. Package Name (`web/package.json`)
- **Original**: `"name": "ntfy"`
- **Workspace**: `"name": "@ntfy-cf/web"`

#### 4. Lint Script (`web/package.json`)
- **Original**: `"lint": "eslint --report-unused-disable-directives --ext .js,.jsx ./src/"`
- **Workspace**: `"lint": "echo ok"`
- **Impact**: No linting is performed. Should be restored to proper eslint config.

#### 5. Vite Config Proxy (`web/vite.config.ts`)
- **Original**: No dev proxy (Go server serves both API and frontend)
- **Workspace**: Added `proxy: { "/v1": "http://localhost:8787", "/config.js": "http://localhost:8787" }`
- **Impact**: Dev-only change for running API and frontend separately.

---

## Backend Status

### Complete Rewrite

The backend is NOT a migration — it is a complete rewrite from Go to TypeScript/Cloudflare Workers.

| Aspect | Original (Go) | Workspace (TypeScript) |
|--------|---------------|----------------------|
| Framework | `net/http` + gorilla/websocket | Hono |
| Realtime | In-memory Go channels | Durable Objects |
| Database | SQLite / PostgreSQL | D1 |
| File store | Filesystem / S3 | R2 |
| Email | SMTP (client + server) | Cloudflare Email binding |
| Web Push | `webpush-go` library | Custom RFC 8291 implementation |
| Auth | bcrypt | PBKDF2-SHA256 |

### Missing API Endpoints

| Endpoint | Original | Workspace |
|----------|----------|-----------|
| `GET /v1/version` | ✅ Returns build version | ❌ Not implemented |
| `GET /v1/stats` | ✅ Returns message stats | ❌ Not implemented |
| `GET /_matrix/push/v1/notify` | ✅ Matrix discovery | ❌ Not implemented |
| `POST /_matrix/push/v1/notify` | ✅ Matrix push | ❌ Not implemented |
| `GET /docs/*` | ✅ Embedded documentation | ❌ Not implemented |
| `POST /v1/account/billing/webhook` | ✅ Stripe webhook | ❌ Not implemented |
| `POST /v1/account/billing/portal` | ✅ Stripe portal | ❌ Not implemented |

### Missing Publish Features

| Feature | Original | Workspace | Severity |
|---------|----------|-----------|----------|
| `X-Actions` header parsing | ✅ Full action support | ❌ Not implemented | **Critical** |
| `X-Cache` disable | ✅ `X-Cache: no` disables caching | ❌ Always caches | Medium |
| `X-Firebase` disable | ✅ `X-Firebase: no` skips FCM | ❌ Always sends FCM | Medium |
| `X-UnifiedPush` | ✅ UnifiedPush mode | ❌ Not supported | Medium |
| `X-Poll-ID` | ✅ Poll request tracking | ❌ Not supported | Medium |
| `X-Sequence-ID` | ✅ Custom sequence ID | ❌ Not supported | Low |
| `X-At` / `X-In` aliases | ✅ Delay aliases | ❌ Not supported | Low |
| `X-Event` custom event | ✅ Custom event types | ❌ Not supported | Low |
| `PUT /{topic}/{id}` update | ✅ Message update by ID | ❌ Not supported | Medium |
| `GET /{topic}/publish` trigger | ✅ Publish via GET | ❌ Not supported | Low |
| Multi-topic WebSocket | ✅ `GET /topic1,topic2/ws` | ❌ Returns 400 | Medium |

### Missing Security Features

| Feature | Original | Workspace | Severity |
|---------|----------|-----------|----------|
| WebSocket auth via `?auth=` | ✅ Double-base64 encoded | ❌ Not implemented | **High** |
| Auth failure rate limiting | ✅ `auth_failure` table | ❌ Not implemented | **High** |
| Per-second rate limiting | ✅ Token-bucket burst/replenish | ❌ Not implemented | **Critical** |

### Missing Database Tables

| Table | Original | Workspace | Impact |
|-------|----------|-----------|--------|
| `auth_failure` | ✅ | ❌ | No brute-force protection |
| `fcm_subscription` | ✅ | ❌ | FCM subs not persisted |
| `fcm_subscription_topic` | ✅ | ❌ | No FCM topic mapping |
| `attachment_deleted` column | ✅ | ❌ | Can't track deleted attachments |

### Missing Indexes

| Index | Original | Workspace | Impact |
|-------|----------|-----------|--------|
| `idx_mid` | ✅ | ❌ | Message ID lookups slower |
| `idx_sequence_id` | ✅ | ❌ | Sequence ID lookups slower |
| `idx_sender` | ✅ | ❌ | Sender-based queries slower |
| `idx_user` | ✅ | ❌ | User-based queries slower |
| `idx_attachment_expires` | ✅ | ❌ | Attachment cleanup slower |

---

## Feature Matrix

| # | Feature | Original | Workspace | Match | Severity |
|---|---------|----------|-----------|-------|----------|
| 1 | React PWA frontend | ✅ | ✅ | ✅ Identical | — |
| 2 | MUI theme (colors, spacing) | ✅ | ✅ | ✅ Identical | — |
| 3 | PWA manifest | ✅ | ✅ | ✅ Identical | — |
| 4 | Service Worker | ✅ | ✅ | ⚠️ i18n-sw import | Low |
| 5 | i18n translations (44 langs) | ✅ | ✅ | ✅ Identical | — |
| 6 | Light/dark/system theme | ✅ | ✅ | ✅ Identical | — |
| 7 | Splash screen | ✅ | ✅ | ✅ Identical | — |
| 8 | Infinite scroll | ✅ | ✅ | ✅ Identical | — |
| 9 | Publish dialog | ✅ | ✅ | ✅ Identical | — |
| 10 | Subscribe dialog | ✅ | ✅ | ✅ Identical | — |
| 11 | Account management | ✅ | ✅ | ✅ Identical | — |
| 12 | Preferences/settings | ✅ | ✅ | ✅ Identical | — |
| 13 | Login/Signup | ✅ | ✅ | ✅ Identical | — |
| 14 | Password reset | ✅ | ✅ | ✅ Identical | — |
| 15 | Email verification | ✅ | ✅ | ✅ Identical | — |
| 16 | `PUT/POST /{topic}` publish | ✅ | ✅ | ⚠️ Missing headers | Critical |
| 17 | `DELETE /{topic}/{id}` | ✅ | ✅ | ✅ | — |
| 18 | `GET /{topic}/json` subscribe | ✅ | ✅ | ✅ | — |
| 19 | `GET /{topic}/sse` subscribe | ✅ | ✅ | ✅ | — |
| 20 | `GET /{topic}/raw` subscribe | ✅ | ✅ | ✅ | — |
| 21 | `GET /{topic}/ws` subscribe | ✅ | ✅ | ⚠️ No auth | High |
| 22 | `GET /{topic}/auth` | ✅ | ✅ | ✅ | — |
| 23 | Multi-topic subscribe (json/sse/raw) | ✅ | ✅ | ✅ | — |
| 24 | Multi-topic WS | ✅ | ✅ | ❌ Returns 400 | Medium |
| 25 | Web Push encryption (RFC 8291) | ✅ | ✅ | ⚠️ Custom impl | — |
| 26 | VAPID authorization | ✅ | ✅ | ⚠️ Custom impl | — |
| 27 | FCM push | ✅ | ✅ | ❌ No DB storage | High |
| 28 | Twilio calls | ✅ | ✅ | ✅ | — |
| 29 | Email sending | ✅ | ✅ | ✅ | — |
| 30 | SMTP receiving | ✅ | ❌ | ❌ | Low |
| 31 | Matrix push gateway | ✅ | ❌ | ❌ | Low |
| 32 | UnifiedPush | ✅ | ❌ | ❌ | Medium |
| 33 | Message templates | ✅ | ❌ | ❌ | Medium |
| 34 | Upstream forwarding | ✅ | ❌ | ❌ | Low |
| 35 | Rate limiting (burst/replenish) | ✅ | ❌ | ❌ | Critical |
| 36 | Auth failure limiting | ✅ | ❌ | ❌ | High |
| 37 | Delayed delivery | ✅ | ✅ | ⚠️ Alarm-based | Medium |
| 38 | `X-Actions` parsing | ✅ | ❌ | ❌ | Critical |
| 39 | Attachment bandwidth tracking | ✅ | ❌ | ❌ | Medium |
| 40 | Stripe billing webhook | ✅ | ❌ (stubbed) | ❌ | Low |
| 41 | `GET /v1/version` | ✅ | ❌ | ❌ | Low |
| 42 | `GET /v1/stats` | ✅ | ❌ | ❌ | Low |
| 43 | Embedded docs (`/docs/*`) | ✅ | ❌ | ❌ | Low |
| 44 | File attachments via R2 | ✅ | ✅ | ✅ | — |
| 45 | Message update via PUT | ✅ | ❌ | ❌ | Medium |
| 46 | `X-Cache` disable | ✅ | ❌ | ❌ | Medium |
| 47 | `X-Firebase` disable | ✅ | ❌ | ❌ | Medium |
| 48 | WebSocket auth via `?auth=` | ✅ | ❌ | ❌ | High |
| 49 | Database indexes (full set) | 8+ indexes | 4 indexes | ⚠️ Partial | Medium |
| 50 | `.dev.vars` for local dev | ❌ | ✅ | Added for Workers | — |

---

## Code Quality Notes

### Security
- No rate limiting on auth endpoints (brute force vulnerability)
- WebSocket connections not authenticated (no auth forwarding to DO)
- Hardcoded VAPID contact email: `admin@finchtech.my`
- `X-Priority` header stripped as Cloudflare workaround

### Maintainability
- `parseActions()` defined but never called in publish handler
- `i18n-sw.js` duplicates `i18n.js` for SW context
- `worker/src/routes/topic.ts` is 978 lines — should be split
- Configuration via env vars only (original has 200+ option config file)

### Performance
- D1 queries have higher latency than embedded SQLite
- No database read replicas
- Durable Object cold starts on first request per topic
- Missing indexes cause table scans

### Testing
- Basic tests exist for health, middleware, topics
- No integration tests for account management, web push, FCM, etc.
- No end-to-end tests
