# API Mapping: ntfy → ntfy-cf

This document describes how the original [ntfy REST API](https://ntfy.sh/docs/api/) maps to this Cloudflare-based implementation.

---

## Endpoint Compatibility

### Topic Operations

| ntfy Endpoint                              | ntfy-cf Status | Notes |
| ------------------------------------------ | -------------- | ----- |
| `PUT /{topic}`                             | ✅ Implemented | Publish (body as message) |
| `POST /{topic}`                            | ✅ Implemented | Publish (body as message) |
| `GET /{topic}/json`                        | ✅ Implemented | Subscribe (ndjson stream) |
| `GET /{topic}/sse`                         | ✅ Implemented | Subscribe (SSE stream) |
| `GET /{topic}/raw`                         | ✅ Implemented | Subscribe (raw text stream) |
| `GET /{topic}/ws`                          | ✅ Implemented | Subscribe (WebSocket) |
| `GET /{topic}/auth`                        | ✅ Implemented | Check topic auth |
| `DELETE /{topic}`                          | ❌ Not implemented | Topic deletion |
| `GET /{topic}/mcast`                       | ❌ Not implemented | Multicast publishing |

### Publish Headers

| ntfy Header        | ntfy-cf Status | Notes |
| ------------------ | -------------- | ----- |
| `Title`            | ✅ Implemented | Mapped to `X-Title` |
| `Priority`         | ✅ Implemented | Mapped to `X-Priority` (1-5) |
| `Tags`             | ✅ Implemented | Mapped to `X-Tags` (comma-separated) |
| `Click`            | ✅ Implemented | Mapped to `X-Click` (URL) |
| `Icon`             | ✅ Implemented | Mapped to `X-Icon` (URL) |
| `Actions`          | ✅ Implemented | Mapped to `X-Actions` (JSON array) |
| `Delay`            | ❌ Not implemented | Scheduled delivery |
| `Email`            | ❌ Not implemented | Publish via email |
| `Call`             | ❌ Not implemented | Publish via phone call |
| `Attach`           | ❌ Not implemented | File attachment uploads |
| `Filename`         | ❌ Not implemented | Attachment filename |
| `Markdown`         | ✅ Implemented | Mapped to `Content-Type: text/markdown` |
| `X-Encoding`       | ✅ Implemented | Content encoding hint |
| `X-Send-As`        | ✅ Implemented | Send as email/call routing |

### Polling Parameters

| ntfy Query Param | ntfy-cf Status | Notes |
| ---------------- | -------------- | ----- |
| `?since=`        | ✅ Implemented | Accepts ID or Unix timestamp |
| `?poll=`         | ✅ Implemented | Long-poll timeout in seconds (default 30) |
| `?scheduled=1`   | ❌ Not implemented | Scheduled messages |

### Server Endpoints

| ntfy Endpoint              | ntfy-cf Status | Notes |
| -------------------------- | -------------- | ----- |
| `GET /v1/health`           | ✅ Implemented | DB connectivity check |
| `GET /v1/stats`            | ✅ Implemented | Message count stats |
| `GET /v1/config`           | ✅ Implemented | Server configuration JSON |
| `GET /v1/config.js`        | ✅ Implemented | Config as JS for web app |
| `GET /v1/metrics`          | ✅ Implemented | Prometheus-format metrics |
| `GET /v1/subscribe/poll`   | ❌ Not implemented | Multi-topic polling |

### Web Push

| ntfy Endpoint              | ntfy-cf Status | Notes |
| -------------------------- | -------------- | ----- |
| `POST /v1/webpush`         | ✅ Implemented | Register/update subscription |
| `DELETE /v1/webpush`       | ✅ Implemented | Remove subscription |
| `PUT /v1/webpush`          | ❌ Not implemented | Partial update |

### Account Management

| ntfy Endpoint                          | ntfy-cf Status | Notes |
| -------------------------------------- | -------------- | ----- |
| `POST /v1/account`                     | ✅ Implemented | Sign-up |
| `GET /v1/account`                      | ✅ Implemented | Get account details |
| `DELETE /v1/account`                   | ✅ Implemented | Soft-delete account |
| `POST /v1/account/token`               | ✅ Implemented | Create auth token |
| `PATCH /v1/account/token`              | ✅ Implemented | Extend token expiry |
| `DELETE /v1/account/token`             | ✅ Implemented | Delete token(s) |
| `POST /v1/account/password`            | ✅ Implemented | Change password |
| `PATCH /v1/account/settings`           | ✅ Implemented | Update preferences/sync topic |
| `POST /v1/account/subscription`        | 🟡 Stub       | Accepts but no-op |
| `PATCH /v1/account/subscription`       | 🟡 Stub       | No-op |
| `DELETE /v1/account/subscription`      | 🟡 Stub       | No-op |
| `POST /v1/account/reservation`         | 🟡 Stub       | No-op (reservations disabled) |
| `DELETE /v1/account/reservation`       | 🟡 Stub       | No-op |
| `PUT /v1/account/phone`               | ✅ Implemented | Add phone number |
| `DELETE /v1/account/phone`            | ✅ Implemented | Remove phone number |
| `PUT /v1/account/email`               | ✅ Implemented | Add email address |
| `DELETE /v1/account/email`            | ✅ Implemented | Remove email address |
| `POST /v1/account/email/verify`        | 🟡 Stub       | Accepts but no-op |
| `POST /v1/account/password/reset/request` | 🟡 Stub    | Accepts but no-op |
| `POST /v1/account/password/reset`      | 🟡 Stub       | Accepts but no-op |

### Admin

| ntfy Endpoint            | ntfy-cf Status | Notes |
| ------------------------ | -------------- | ----- |
| `GET /v1/users`          | ✅ Implemented | List users (admin only) |
| `POST /v1/users`         | ✅ Implemented | Create user (admin only) |
| `DELETE /v1/users`       | ✅ Implemented | Soft-delete user (admin only) |
| `PUT /v1/users/access`   | ✅ Implemented | Set topic access (admin only) |
| `DELETE /v1/users/access`| ✅ Implemented | Remove topic access (admin only) |

---

## Authentication

ntfy-cf supports three authentication mechanisms, matching the upstream ntfy API.

### Basic Authentication

```
Authorization: Basic base64(username:password)
```

- Password is verified against the stored PBKDF2-SHA256 hash.
- Supported on all authenticated endpoints.

### Bearer Token

```
Authorization: Bearer <token>
```

- Tokens are stored in `user_token` table.
- Raw tokens (starting with `nk`) are also accepted without the `Bearer` prefix.

### Query Parameter

```
GET /{topic}/json?auth=<token>
```

- Useful for WebSocket connections where headers cannot be set.

### Anonymous Access

- Unauthenticated requests are treated as the built-in `*` user (`u_everyone`).
- Anonymous publish is permitted unless the topic is restricted via `user_access`.

### Response on Auth Failure

```json
{
  "code": 40101,
  "http_code": 401,
  "error": "Invalid credentials",
  "link": "https://ntfy.sh/docs"
}
```

---

## Response Format

### Success: Publish

**Status**: `201 Created`

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
  "actions": [{"id": "view", "action": "view", "label": "Open", "url": "https://..."}]
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

Common error codes:

| Code   | HTTP Status | Meaning |
| ------ | ----------- | ------- |
| 40001  | 400         | Bad request / validation |
| 40101  | 401         | Invalid credentials |
| 40301  | 403         | Sign-up disabled |
| 40303  | 403         | Rate limit exceeded |
| 40401  | 404         | Not found |
| 40901  | 409         | Conflict (e.g. username taken) |
| 40401  | 404         | Route not found (fallback) |

### Response Format Differences from ntfy

| Aspect              | ntfy                                | ntfy-cf                              |
| ------------------- | ----------------------------------- | ------------------------------------ |
| Message `expires`   | Included in response                | Not returned in publish response     |
| `attachment` object | Included if attachment present       | Attachments not yet implemented      |
| `encoding`          | Included                            | Not returned in publish response     |
| `content_type`      | Included                            | Not returned in publish response     |
| `actions` default   | `[]` (empty array)                  | `null` or `undefined` when empty     |
| `tags` default      | `[]`                                | `null` or `undefined` when empty     |

---

## Missing Features

Features not yet implemented compared to upstream ntfy:

| Feature               | Impact |
| --------------------- | ------ |
| **File Attachments**  | No `Attach` header support; attachment fields exists in schema |
| **Email Publishing**  | No SMTP integration; `X-Email` header parsing not implemented |
| **Phone Calls**       | No TTS/call integration |
| **Scheduled Delivery**| No `Delay` header; no scheduled messages |
| **Topic Deletion**    | No `DELETE /{topic}` endpoint |
| **Multi-topic Poll**  | No `/v1/subscribe/poll` endpoint |
| **Reservations**      | Topic reservations stubs only |
| **Password Reset**    | Magic link stubs; no email delivery |
| **Stripe Integration**| `stripe_customer_id` and `stripe_subscription_id` columns exist but unused |
