# ntfy Reference Analysis

**Repository**: [binwiederhier/ntfy](https://github.com/binwiederhier/ntfy)
**Language**: Go (backend) + React (frontend/PWA)
**License**: Apache 2.0 & GPLv2 (dual)
**Author**: Philipp C. Heckel
**Analyzed at**: Commit `main` (cloned 2026-07-18)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                      ntfy Server                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  HTTP Server  │  │  SMTP Server │  │ Background │ │
│  │  (net/http)   │  │  (incoming)  │  │  Workers   │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┘ │
│         │                 │                           │
│  ┌──────┴─────────────────┴───────────────────────┐  │
│  │              Server struct (server.go)          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │
│  │  │  Topics  │ │ Visitors │ │ Message Cache  │  │  │
│  │  │ (in mem) │ │ (rate    │ │ (SQLite/PG)    │  │  │
│  │  │          │ │  limit)  │ │                │  │  │
│  │  └──────────┘ └──────────┘ └────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Key characteristics:**
- Single binary deployment (Go)
- SQLite for single-node, PostgreSQL for production
- In-memory Go channels for real-time pub/sub
- File system or S3 for attachments
- SMTP for email (both sending and receiving)
- Twilio for phone calls/SMS
- Firebase Cloud Messaging for Android push
- Stripe for billing/subscriptions

---

## 2. Backend Packages

### server/ — Core server
| File | Purpose |
|------|---------|
| `server.go` | `Server` struct, `Run()`, HTTP routing (`handleInternal()`) |
| `config.go` | Config struct (~70+ fields), YAML loading, defaults |
| `topic.go` | Topic struct with subscriber map, publish, keepalive |
| `visitor.go` | Per-IP/user rate limiting (token buckets + daily limits) |
| `errors.go` | HTTP error codes and messages |
| `types.go` | API request/response types |
| `server_auth.go` | Authentication handlers |
| `server_account.go` | Account CRUD + tokens + phone + email + subscriptions + reservations |
| `server_admin.go` | Admin user management + access control |
| `server_firebase.go` | Firebase Cloud Messaging integration |
| `server_webpush.go` | Web Push (VAPID) subscription management |
| `server_matrix.go` | Matrix push gateway |
| `server_payments.go` | Stripe billing integration |
| `server_twilio.go` | Twilio phone call integration |
| `server_web.go` | Web app serving, config.js, manifest |
| `server_middleware.go` | Middleware: auth, rate limit, CORS |
| `server_manager.go` | Background manager (pruning, stats) |
| `server_template.go` | Message templating (Grafana, GitHub, etc.) |
| `smtp_server.go` | Incoming SMTP server (publish via email) |
| `util.go` | Parameter parsing, IP extraction |

### user/ — User management
| File | Purpose |
|------|---------|
| `manager.go` | User manager interface + implementation |
| `manager_sqlite.go` | SQLite backend |
| `manager_postgres.go` | PostgreSQL backend |
| `types.go` | User, Tier, Token, Grant, Permission, Prefs models |
| `access_cache.go` | In-memory ACL cache with TTL |
| `util.go` | bcrypt password hashing, validation |

### message/ — Message cache
| File | Purpose |
|------|---------|
| `cache.go` | Cache interface |
| `cache_sqlite.go` | SQLite message cache |
| `cache_postgres.go` | PostgreSQL message cache |
| `cache_sqlite_schema.go` | SQLite schema definition |

### model/ — Data models
| File | Purpose |
|------|---------|
| `model.go` | Message, Attachment, Action, SinceMarker structs |

### attachment/ — File attachments
| File | Purpose |
|------|---------|
| `backend.go` | Attachment backend interface |
| `backend_file.go` | Filesystem backend |
| `backend_s3.go` | S3-compatible backend |
| `store.go` | Attachment store (DB) |

---

## 3. API Routes

### Topic Operations
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/` | `handleWebApp` | Serve web app |
| GET | `/{topic}` | → web app | View topic |
| PUT/POST | `/{topic}` | `handlePublish` | Publish message |
| PUT/POST | `/{topic}/{seqID}` | `handlePublish` | Update by seq ID |
| GET | `/{topic}/json` | `handleSubscribeJSON` | NDJSON stream |
| GET | `/{topic}/sse` | `handleSubscribeSSE` | SSE stream |
| GET | `/{topic}/raw` | `handleSubscribeRaw` | Raw text stream |
| GET | `/{topic}/ws` | `handleSubscribeWS` | WebSocket |
| GET | `/{topic}/auth` | `handleTopicAuth` | Auth check |
| GET | `/{topic}/publish` | `handlePublish` | Publish via GET |
| DELETE | `/{topic}/{id}` | `handleDelete` | Delete message |
| GET/PUT | `/{topic}/{id}/clear` | `handleClear` | Mark read |
| DELETE | `/{topic}` | `handleDelete` | Clear topic |
| GET | `/{topic1,topic2}/json` | `handleSubscribeJSON` | Multi-topic JSON |
| GET | `/{topic1,topic2}/sse` | `handleSubscribeSSE` | Multi-topic SSE |
| GET | `/{topic1,topic2}/raw` | `handleSubscribeRaw` | Multi-topic raw |
| GET | `/{topic1,topic2}/ws` | `handleSubscribeWS` | Multi-topic WS |
| GET | `/file/{id}` | `handleFile` | Download attachment |

### Server Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/health` | Health check |
| GET | `/v1/config` | Public config JSON |
| GET | `/v1/stats` | Server stats |
| GET | `/v1/version` | Build version (admin) |
| GET | `/v1/metrics` | Prometheus metrics |
| GET | `/config.js` | JS config for web app |
| GET | `/manifest.webmanifest` | PWA manifest |
| GET | `/docs/*` | Embedded documentation |

### Account Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/DELETE | `/v1/account` | Get/create/delete account |
| POST | `/v1/account/login` | Login (returns token + username) |
| POST/PATCH/DELETE | `/v1/account/token` | Token CRUD |
| POST | `/v1/account/password` | Change password |
| PATCH | `/v1/account/settings` | Update preferences |
| POST/PATCH/DELETE | `/v1/account/subscription` | Subscription CRUD |
| POST/DELETE | `/v1/account/reservation` | Topic reservation |
| PUT/DELETE | `/v1/account/phone` | Phone management |
| PUT/DELETE | `/v1/account/email` | Email management |
| POST | `/v1/account/email/verify` | Email verification |
| POST | `/v1/account/password/reset/request` | Password reset request |
| POST | `/v1/account/password/reset` | Password reset confirm |
| GET | `/v1/tiers` | List billing tiers |
| POST | `/v1/account/billing/subscription` | Create/update subscription |
| DELETE | `/v1/account/billing/subscription` | Cancel subscription |
| POST | `/v1/account/billing/portal` | Stripe portal |
| POST | `/v1/account/billing/webhook` | Stripe webhook |

### Admin Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET/POST/PUT/DELETE | `/v1/users` | User CRUD |
| PUT/DELETE | `/v1/users/access` | Access control |

### Web Push
| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/webpush` | Register/update subscription |
| PUT | `/v1/webpush` | Partial update (topics only) |
| DELETE | `/v1/webpush` | Remove subscription |

### Matrix
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/_matrix/push/v1/notify` | Matrix push gateway |

---

## 4. Data Model

### Message
```go
type Message struct {
    ID         int64         // Primary key
    SequenceID int64         // Deduplication key per topic
    Time       int64         // Unix timestamp
    Expires    int64         // Expiry timestamp (0 = never)
    Event      string        // "message", "delete", "open", "poll_request"
    Topic      string
    Title      string
    Message    string
    Priority   int           // 1-5 (min, low, default, high, max)
    Tags       []string
    Click      string        // URL to open
    Icon       string        // Icon URL
    Actions    []*Action     // Action buttons
    Attachment *Attachment
    PollID     string
    ContentType string
    Encoding   string
    Sender     netip.Addr    // IP for rate limiting
    User       string        // UserID for attachment association
}
```

### User
```go
type User struct {
    ID       string
    Name     string
    Hash     string           // bcrypt hash
    Role     string           // "admin" or "user"
    Tier     *Tier
    Prefs    UserPrefs
    Billing  BillingConfig
    Stats    UserStats
}

type Permission int           // DenyAll, Read, Write, ReadWrite
type Tier struct {            // Message limits, email limits, attachment limits
    Name       string
    Code       string
    DailyMessages int
    DailyEmails   int
    AttachmentSize int64
    AttachmentTotalSize int64
    AttachmentExpiryDuration int64
    StripePriceID string
}
```

### Token
```go
type Token struct {
    ID          string
    UserID      string
    Token       string
    Label       string
    LastAccess  int64
    LastOrigin  string
    Expires     int64
    Provisioned int
}
```

---

## 5. Database Schema

**SQLite tables:**
- `messages` — notification messages
- `message_stats` — aggregate message counter
- `tier` — pricing/rate-limit tiers
- `user` — user accounts (FK to tier)
- `user_access` — per-topic access control
- `user_token` — API tokens
- `user_phone` — phone numbers
- `user_email` — email addresses
- `user_magic_link` — magic link tokens
- `webpush_subscription` — Web Push subscriptions
- `webpush_subscription_topic` — Web Push topic mappings
- `fcm_subscription` — FCM subscriptions
- `fcm_subscription_topic` — FCM topic mappings
- `auth_failure` — brute force protection

---

## 6. Authentication & Security

- **Basic Auth**: `Authorization: Basic base64(user:pass)`
- **Bearer Token**: `Authorization: Bearer <token>` or `?auth=<token>`
- **Password hashing**: bcrypt (configurable cost)
- **Token expiry**: Configurable per-token
- **Rate limiting**: Per-visitor (IP or user/tier)
  - Token buckets: requests, messages, emails, calls, subscriptions, topic creation, bandwidth
  - Daily reset with configurable time
  - IP prefix grouping (`/32` IPv4, `/64` IPv6)
- **Auth failure tracking**: Count-based lockout, exponential backoff

---

## 7. Real-time Delivery

- **In-memory topic map**: `map[string]*topic`
- **Each topic**: holds subscriber set (WebSocket, SSE, JSON, raw connections)
- **Publish**: iterates subscribers, sends message via channel
- **WebSocket**: gorilla/websocket library, binary/text frames
- **SSE**: standard `text/event-stream`
- **JSON/raw**: newline-delimited streams
- **Keepalive**: periodic ping/pong, connection timeout

---

## 8. Frontend Architecture

**Stack**: React 19, MUI v9, Dexie.js, i18next, react-router-dom v6, Workbox, Vite

**Key modules**:
- `Api.js` — HTTP API client (poll, publish, topic auth, Web Push)
- `AccountApi.js` — Account management REST client
- `Connection.js` — Single WebSocket with retry/backoff
- `ConnectionManager.js` — Multi-WebSocket orchestrator
- `SubscriptionManager.js` — IndexedDB CRUD for subscriptions/notifications
- `Notifier.js` — Desktop notifications + sound + Web Push
- `Session.js` — Auth session (localStorage + IndexedDB replica)
- `Poller.js` — HTTP polling fallback
- `Pruner.js` — Old notification cleanup

**Theme**: MUI light/dark with `#338574` (light) / `#65b5a3` (dark) primary, `#1b2124` dark paper background

**PWA**: Service worker with Workbox precaching, push event handling, notification click/dismiss actions, periodic sync for token extension
