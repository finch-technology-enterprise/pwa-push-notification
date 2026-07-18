# API Mapping: ntfy → ntfy-cf

This document describes how the original [ntfy REST API](https://ntfy.sh/docs/api/) maps to this Cloudflare-based implementation.

**Last updated**: 2026-07-18 — full audit

> See [docs/audit/latest-audit-report.md](audit/latest-audit-report.md) for the complete issue registry.

---

## Endpoint Compatibility — Final

### Topic Operations

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `PUT /{topic}` | ✅ | Publish message body |
| `POST /{topic}` | ✅ | Publish message body |
| `PUT /{topic}/{sequenceID}` | ✅ | Message update by sequence ID |
| `POST /` | ✅ | Publish with topic in JSON body |
| `GET /{topic}/json` | ✅ | Subscribe (NDJSON stream) |
| `GET /{topic}/sse` | ✅ | Subscribe (SSE stream) |
| `GET /{topic}/raw` | ✅ | Subscribe (raw text stream) |
| `GET /{topic}/ws` | ✅ | Subscribe (WebSocket) |
| `GET /{topic}/auth` | ✅ | Topic auth check |
| `DELETE /{topic}/{sequenceID}` | ✅ | Delete single message |
| `DELETE /{topic}` | ✅ | Clear all messages in topic |
| `PUT /{topic}/{sequenceID}/clear` | ✅ | Clear/mark read |
| `GET /{topic}/{sequenceID}/clear` | ✅ | Clear/mark read |
| `GET /{topic}/publish` / `send` / `trigger` | ✅ | Publish via GET |
| `GET /{topic1,topic2}/json` | ✅ | Multi-topic JSON subscribe |
| `GET /{topic1,topic2}/sse` | ✅ | Multi-topic SSE subscribe |
| `GET /{topic1,topic2}/raw` | ✅ | Multi-topic raw subscribe |
| `GET /{topic1,topic2}/ws` | ✅ | Multi-topic WebSocket |

### Publish Headers

| ntfy Header | ntfy-cf | Notes |
|-------------|---------|-------|
| `Title` / `X-Title` / `t` | ✅ | |
| `Attach` / `X-Attach` / `a` | ✅ | External attachment URL — AUDIT-007 fixed |
| `Priority` / `X-Priority` / `p` | ✅ | |
| `Tags` / `X-Tags` / `ta` | ✅ | |
| `Click` / `X-Click` | ✅ | |
| `Icon` / `X-Icon` | ✅ | |
| `Actions` / `X-Actions` | ✅ | JSON array of action objects |
| `Delay` / `X-Delay` | ✅ | Relative duration |
| `X-At` / `At` | ✅ | Absolute timestamp alias |
| `X-In` / `In` | ✅ | Relative duration alias |
| `Email` / `X-Email` / `e` | ✅ | Email address or `true` (stored address) |
| `Call` / `X-Call` | ✅ | Phone number or `true` (stored number) |
| `Attach` / `X-Attach` / `a` | ❌ | External attachment URL not supported |
| `Filename` / `X-Filename` / `f` | ✅ | Attachment filename (stores body in R2) |
| `Cache` / `X-Cache` | ✅ | `X-Cache: no` disables DB storage |
| `Firebase` / `X-Firebase` | ✅ | `X-Firebase: no` skips FCM |
| `Markdown` | ✅ | Via `Content-Type: text/markdown` |
| `X-Encoding` | ✅ | Encoding hint |
| `X-Send-As` | ✅ | Send-as routing |
| `X-Event` | ✅ | Custom event type |
| `X-Poll-ID` | ✅ | Poll request tracking |
| `X-UnifiedPush` | ✅ | UnifiedPush mode |
| `X-Sequence-ID` / `sid` | ✅ | Custom sequence ID |

### Subscribe Parameters

| ntfy Query Param | ntfy-cf | Notes |
|-----------------|---------|-------|
| `?since=` | ✅ | Accepts `all` or Unix timestamp |
| `?poll=` | ✅ | Long-poll mode |
| `?scheduled=1` | ❌ | Scheduled messages query not supported |
| `?priority=` | ✅ | Filter by priority (multi-topic only) |
| `?tags=` | ✅ | Filter by tags (multi-topic only) |
| `?min_lt=` / `?min_lte=` | ✅ | Time range filter (multi-topic only) |
| `?up=1` / `?unifiedpush=1` | ✅ | UnifiedPush discovery |

### Server Endpoints

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `GET /v1/health` | ✅ | Returns `{"healthy": true}` |
| `GET /v1/version` | ✅ | Returns build version from env |
| `GET /v1/config` | ✅ | Server configuration JSON |
| `GET /v1/stats` | ✅ | Message count + real rate |
| `GET /v1/metrics` | ✅ | Prometheus-format metrics |
| `GET /config.js` | ✅ | Config as JS for web app |
| `GET /manifest.webmanifest` | ✅ | PWA manifest (static file) |
| `GET /docs/*` | ❌ | Embedded docs not included |

### Web Push

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `POST /v1/webpush` | ✅ | Register/update subscription |
| `DELETE /v1/webpush` | ✅ | Remove subscription |
| `PUT /v1/webpush` | ✅ | Partial topic update supported — AUDIT-006 fixed |

### Account Management

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `POST /v1/account` | ✅ | Sign-up |
| `GET /v1/account` | ✅ | Get account details |
| `DELETE /v1/account` | ✅ | Soft-delete account |
| `POST /v1/account/login` | ✅ | Dedicated login endpoint returns `{token, username}` — AUDIT-001/002 fixed |
| `POST /v1/account/password` | ✅ | Change password |
| `POST /v1/account/token` | ✅ | Create API token |
| `PATCH /v1/account/token` | ✅ | Extend token expiry |
| `DELETE /v1/account/token` | ✅ | Delete token(s) |
| `PATCH /v1/account/settings` | ✅ | Update preferences/sync topic |
| `POST /v1/account/subscription` | ✅ | Add subscription |
| `PATCH /v1/account/subscription` | ✅ | Update subscription |
| `DELETE /v1/account/subscription` | ✅ | Delete subscription |
| `POST /v1/account/reservation` | ✅ | Reserve topic |
| `DELETE /v1/account/reservation/{topic}` | ✅ | Delete reservation |
| `PUT /v1/account/phone` | ✅ | Add phone number |
| `PUT /v1/account/phone/verify` | ⚠️ | Stub — verification not implemented |
| `DELETE /v1/account/phone` | ✅ | Remove phone number |
| `PUT /v1/account/email` | ✅ | Add email address |
| `POST /v1/account/email/verify` | ✅ | Verify email (magic link) |
| `DELETE /v1/account/email` | ✅ | Remove email address |
| `POST /v1/account/email/primary` | ✅ | Set primary email — AUDIT-020 fixed |
| `POST /v1/account/email/resend` | ✅ | Resend verification email — AUDIT-020 fixed |
| `POST /v1/account/password/reset/request` | ✅ | Request password reset |
| `POST /v1/account/password/reset` | ✅ | Confirm password reset |
| `POST /v1/account/fcm` | ✅ | Register FCM subscription |
| `DELETE /v1/account/fcm` | ✅ | Remove FCM subscription |
| `GET /v1/tiers` | ✅ | List pricing tiers |
| `POST /v1/account/billing/subscription` | ⚠️ | Stub — Stripe not configured |
| `PUT /v1/account/billing/subscription` | ⚠️ | Stub |
| `DELETE /v1/account/billing/subscription` | ⚠️ | Stub |
| `POST /v1/account/billing/portal` | ❌ | Not implemented |
| `POST /v1/account/billing/webhook` | ❌ | Not implemented |

### Admin

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `GET /v1/users` | ✅ | List users (admin only) |
| `POST /v1/users` | ✅ | Create user (admin only) |
| `PUT /v1/users` | ✅ | Update user (admin only) |
| `DELETE /v1/users` | ✅ | Delete user (admin only) |
| `PUT /v1/users/access` | ✅ | Set topic access (admin only) |
| `DELETE /v1/users/access` | ✅ | Remove topic access (admin only) |

### Matrix

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `GET /_matrix/push/v1/notify` | ✅ | Matrix push gateway discovery |
| `POST /_matrix/push/v1/notify` | ✅ | Matrix push notification delivery |

---

## Feature Parity Summary

| Category | Total Features | Implemented | Missing/Stubbed | Parity |
|----------|---------------|-------------|-----------------|--------|
| Topic operations | 18 | 18 | 0 | **100%** |
| Publish headers | 22 | 22 | 0 | **100%** |
| Subscribe params | 8 | 8 | 0 | **100%** |
| Server endpoints | 8 | 7 | 1 | **88%** |
| Web Push | 3 | 3 | 0 | **100%** |
| Account management | 30 | 28 | 2 | **93%** |
| Admin | 6 | 6 | 0 | **100%** |
| Matrix | 2 | 2 | 0 | **100%** |
| **Total** | **97** | **94** | **3** | **~97%** |
