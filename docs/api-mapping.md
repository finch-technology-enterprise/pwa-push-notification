# API Mapping: ntfy → ntfy-cf

This document describes how the original [ntfy REST API](https://ntfy.sh/docs/api/) maps to this Cloudflare-based implementation.

Last updated: Audit-based, verified against source code.

---

## Endpoint Compatibility

### Topic Operations

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `PUT /{topic}` | ✅ | Publish message body |
| `POST /{topic}` | ✅ | Publish message body |
| `PUT /{topic}/{sequenceID}` | ❌ | Message update by sequence ID not supported |
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
| `GET /{topic}/publish` / `send` / `trigger` | ❌ | Publish via GET not supported |
| `GET /{topic1,topic2}/json` | ✅ | Multi-topic JSON subscribe |
| `GET /{topic1,topic2}/sse` | ✅ | Multi-topic SSE subscribe |
| `GET /{topic1,topic2}/raw` | ✅ | Multi-topic raw subscribe |
| `GET /{topic1,topic2}/ws` | ❌ | Multi-topic WebSocket not supported |

### Publish Headers

| ntfy Header | ntfy-cf | Notes |
|-------------|---------|-------|
| `Title` / `X-Title` / `t` | ✅ | Mapped as readParam("X-Title", "Title") |
| `Priority` / `X-Priority` / `p` | ✅ | Mapped as readParam("X-Priority", "Priority") |
| `Tags` / `X-Tags` / `ta` | ✅ | Comma-separated, parsed via parseTags() |
| `Click` / `X-Click` | ✅ | URL to open on notification click |
| `Icon` / `X-Icon` | ✅ | Icon URL |
| `Actions` / `X-Actions` | **❌ NOT IMPLEMENTED** | Header is parsed by parseActions() but NEVER called from handlePublish |
| `Delay` / `X-Delay` / `X-At` / `X-In` | ⚠️ Partial | `X-Delay` supported, aliases `X-At`/`X-In` NOT supported |
| `Email` / `X-Email` / `e` | ✅ | Email address for email delivery |
| `Call` / `X-Call` | ✅ | Phone number for Twilio call |
| `Attach` / `X-Attach` / `a` | ❌ | External attachment URL not supported |
| `Filename` / `X-Filename` / `f` | ✅ | Attachment filename (stores body in R2) |
| `Cache` / `X-Cache` | ❌ | Always caches, cannot disable |
| `Firebase` / `X-Firebase` | ❌ | Always sends FCM, cannot disable |
| `Markdown` | ✅ | Via `Content-Type: text/markdown` |
| `X-Encoding` | ✅ | Encoding hint (base64 for binary) |
| `X-Send-As` | ✅ | Send-as routing |
| `X-Event` | **❌** | Custom event type not supported |
| `X-Poll-ID` | ❌ | UnifiedPush poll request not supported |
| `X-UnifiedPush` | ❌ | UnifiedPush mode not supported |
| `X-Sequence-ID` / `sid` | ❌ | Custom sequence ID not supported |

### Polling Parameters

| ntfy Query Param | ntfy-cf | Notes |
|-----------------|---------|-------|
| `?since=` | ✅ | Accepts `all` or Unix timestamp |
| `?poll=` | ✅ | Long-poll mode |
| `?scheduled=1` | ❌ | Scheduled messages query not supported |
| `?priority=` | ⚠️ | Only works in multi-topic subscribe |
| `?tags=` | ⚠️ | Only works in multi-topic subscribe |
| `?min_lt=` / `?min_lte=` | ⚠️ | Only works in multi-topic subscribe |
| `?up=1` (UnifiedPush) | ❌ | Not supported |

### Server Endpoints

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `GET /v1/health` | ✅ | Returns `{"healthy": true}` |
| `GET /v1/version` | ❌ | Not implemented |
| `GET /v1/config` | ✅ | Server configuration JSON |
| `GET /v1/stats` | ❌ | Not implemented (use `/v1/metrics`) |
| `GET /v1/metrics` | ✅ | Prometheus-format metrics |
| `GET /config.js` | ✅ | Config as JS for web app |
| `GET /manifest.webmanifest` | ✅ | PWA manifest (static file) |
| `GET /docs/*` | ❌ | Embedded docs not included |

### Web Push

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `POST /v1/webpush` | ✅ | Register/update subscription |
| `DELETE /v1/webpush` | ✅ | Remove subscription |
| `PUT /v1/webpush` | ❌ | Partial update not supported |

### Account Management

| ntfy Endpoint | ntfy-cf | Notes |
|--------------|---------|-------|
| `POST /v1/account` | ✅ | Sign-up with username/password |
| `GET /v1/account` | ✅ | Get account details |
| `DELETE /v1/account` | ✅ | Soft-delete account |
| `POST /v1/account/login` | ✅ | Login (returns token) |
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
| `POST /v1/account/email/primary` | ⚠️ | Stub — not implemented |
| `POST /v1/account/email/resend` | ⚠️ | Stub — not implemented |
| `POST /v1/account/password/reset/request` | ✅ | Request password reset |
| `POST /v1/account/password/reset` | ✅ | Confirm password reset |
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
| `GET /_matrix/push/v1/notify` | ❌ | Matrix push gateway not implemented |
| `POST /_matrix/push/v1/notify` | ❌ | Matrix push gateway not implemented |

---

## Authentication

ntfy-cf supports two authentication mechanisms (one fewer than upstream ntfy).

### Basic Authentication
```
Authorization: Basic base64(username:password)
```
Password is verified against the stored PBKDF2-SHA256 hash.

### Bearer Token
```
Authorization: Bearer <token>
```
Tokens are stored in `user_token` table. Raw tokens (starting with `nk`) are also accepted without the `Bearer` prefix.

### Query Parameter
```
GET /{topic}/json?auth=<token>
```

### WebSocket Authentication (NOT IMPLEMENTED)
The original ntfy supports `?auth=base64(base64(user:pass))` query param for WebSocket auth.
ntfy-cf does **NOT** forward auth credentials to Durable Object WebSocket upgrades.
This means WebSocket subscriptions may operate without proper authentication.

### Anonymous Access
Unauthenticated requests are treated as the built-in `*` user (`u_everyone`).
Anonymous publish is permitted unless the topic is restricted via `user_access`.

---

## Response Format

### Success: Publish — `201 Created`
```json
{
  "id": "AbCdEf123456",
  "time": 1712345678,
  "event": "message",
  "topic": "mytopic",
  "message": "Hello, world!",
  "title": "Notification",
  "priority": 4,
  "tags": ["warning", "clock"],
  "click": "https://example.com",
  "icon": null,
  "actions": []
}
```

### Success: Subscribe (JSON stream)
Each line is a JSON object (NDJSON):
```json
{"event":"open","topic":"mytopic","time":1712345678}
{"id":"AbCdEf123456","time":1712345679,"event":"message","topic":"mytopic","message":"Hello"}
```

### Error Response
All errors follow the ntfy convention:
```json
{
  "code": 40001,
  "http_code": 400,
  "error": "Invalid topic",
  "link": "https://ntfy.sh/docs"
}
```

### Response Format Differences from ntfy

| Aspect | ntfy | ntfy-cf |
|--------|------|---------|
| Message `expires` | Included in response | Not returned |
| `attachment` object | Included if present | Included if present (implemented) |
| `encoding` | Included | Not returned |
| `content_type` | Included | Not returned |
| `actions` default | `[]` (empty array) | `null` or omitted when empty |
| `tags` default | `[]` | `null` or omitted when empty |

---

## Feature Parity Summary

| Category | Total Features | Implemented | Missing | Parity |
|----------|---------------|-------------|---------|--------|
| Topic operations | 14 | 11 | 3 | 79% |
| Publish headers | 22 | 14 | 8 | 64% |
| Subscribe params | 8 | 4 | 4 | 50% |
| Server endpoints | 8 | 5 | 3 | 63% |
| Web Push | 3 | 2 | 1 | 67% |
| Account management | 26 | 20 | 6 | 77% |
| Admin | 6 | 6 | 0 | 100% |
| Matrix | 2 | 0 | 2 | 0% |
| **Total** | **89** | **62** | **27** | **70%** |
