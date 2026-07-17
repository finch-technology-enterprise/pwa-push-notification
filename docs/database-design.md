# Database Design

ntfy-cf uses **Cloudflare D1** (a SQLite-compatible serverless relational database) for all persistent storage. The schema is defined in [`worker/src/db.ts`](../worker/src/db.ts) and the SQL migration file is at [`migrations/0001_initial.sql`](../migrations/0001_initial.sql).

---

## Entity Relationship Diagram

```
tier ──1:N──> user ──1:N──> user_token
                   │
                   ├──1:N──> user_access
                   ├──1:N──> user_phone
                   ├──1:N──> user_email
                   ├──1:N──> user_magic_link
                   └──1:N──> messages

webpush_subscription ──1:N──> webpush_subscription_topic

message_stats  (standalone singleton)
schema_version (standalone store)
```

**Missing tables compared to original ntfy:**
- `auth_failure` — rate limiting for failed authentication attempts
- `fcm_subscription` / `fcm_subscription_topic` — FCM push subscription persistence

---

## Tables

### `messages`

Stores every published notification message.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | | Random alphanumeric ID (12 chars) |
| `sequence_id` | TEXT | | Timestamp-based sortable ID |
| `time` | INTEGER | | Unix timestamp of publication |
| `event` | TEXT | | Event type: `message`, `message_delete`, `message_clear` |
| `expires` | INTEGER | `0` | Expiration timestamp (0 = never) |
| `scheduled_for` | INTEGER | `0` | Scheduled delivery time (workspace-added) |
| `topic` | TEXT | | Target topic name |
| `message` | TEXT | `''` | Message body |
| `title` | TEXT | `''` | Notification title |
| `priority` | INTEGER | `3` | Priority 1-5 (3 = default) |
| `tags` | TEXT | `''` | Comma-separated tag strings |
| `click` | TEXT | `''` | URL to open on click |
| `icon` | TEXT | `''` | Icon URL |
| `actions` | TEXT | `'[]'` | JSON array of action objects |
| `attachment_name` | TEXT | `''` | Attachment filename |
| `attachment_type` | TEXT | `''` | Attachment MIME type |
| `attachment_size` | INTEGER | `0` | Attachment file size |
| `attachment_expires` | INTEGER | `0` | Attachment expiry timestamp |
| `attachment_url` | TEXT | `''` | Attachment download URL |
| `sender` | TEXT | `''` | Sender identifier (IP or username) |
| `user_id` | TEXT | `''` | User ID of sender |
| `content_type` | TEXT | `''` | Content type (e.g. `text/markdown`) |
| `encoding` | TEXT | `''` | Encoding hint |
| `published` | INTEGER | `1` | Published flag (boolean) |

**Indexes:**

| Name | Columns | Purpose |
|------|---------|---------|
| `idx_messages_topic` | `topic` | Lookup messages by topic |
| `idx_messages_time` | `time` | Time-range queries |
| `idx_messages_expires` | `expires` | Expired message cleanup |
| `idx_messages_topic_time` | `topic, time DESC` | Topic-ordered message listing |

**Differences from original ntfy:**

| Aspect | Original | ntfy-cf |
|--------|----------|---------|
| Column `mid` (AUTOINCREMENT PK) | `mid INTEGER PRIMARY KEY AUTOINCREMENT` | `id TEXT PRIMARY KEY` |
| Column `user` | `user TEXT` | `user_id TEXT` |
| Column `attachment_deleted` | Included | **Missing** |
| Column `scheduled_for` | Not present | **Added** |
| Index `idx_mid` | ✅ | ❌ Missing |
| Index `idx_sequence_id` | ✅ | ❌ Missing |
| Index `idx_sender` | ✅ | ❌ Missing |
| Index `idx_user` | ✅ | ❌ Missing |
| Index `idx_attachment_expires` | ✅ | ❌ Missing |

### `message_stats`

Singleton row for aggregate message counting.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | TEXT PK | | Always `"messages"` |
| `value` | INTEGER | `0` | Total published message count |

Seeded with `INSERT OR IGNORE INTO message_stats (key, value) VALUES ('messages', 0)`.

### `tier`

Pricing/rate-limit tiers (mirrors the upstream ntfy billing model).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | | Tier ID |
| `code` | TEXT UNIQUE | | Machine-readable tier code |
| `name` | TEXT | | Human-readable tier name |
| `messages_limit` | INTEGER | `0` | Max messages per period |
| `messages_expiry_duration` | INTEGER | `0` | Message retention duration |
| `emails_limit` | INTEGER | `0` | Max emails per period |
| `calls_limit` | INTEGER | `0` | Max calls per period |
| `reservations_limit` | INTEGER | `0` | Max topic reservations |
| `attachment_file_size_limit` | INTEGER | `0` | Max attachment size |
| `attachment_total_size_limit` | INTEGER | `0` | Total attachment storage limit |
| `attachment_expiry_duration` | INTEGER | `0` | Attachment expiry duration |
| `attachment_bandwidth_limit` | INTEGER | `0` | Attachment bandwidth limit |

### `user`

Registered user accounts.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | | Random user ID |
| `tier_id` | TEXT | `null` | FK to `tier.id` |
| `user_name` | TEXT UNIQUE | | Login username (called `user` in original) |
| `pass` | TEXT | | Password hash (PBKDF2-SHA256) |
| `role` | TEXT | | `anonymous`, `user`, or `admin` (with CHECK constraint) |
| `prefs` | TEXT | `'{}'` | JSON preferences object |
| `sync_topic` | TEXT | `''` | Topic for cross-device sync |
| `provisioned` | INTEGER | `0` | Admin-created flag |
| `stats_messages` | INTEGER | `0` | Message count stat |
| `stats_emails` | INTEGER | `0` | Email count stat |
| `stats_calls` | INTEGER | `0` | Call count stat |
| `stripe_customer_id` | TEXT | `null` | Stripe customer ID |
| `stripe_subscription_id` | TEXT | `null` | Stripe subscription ID |
| `created` | INTEGER | | Account creation timestamp |
| `deleted` | INTEGER | `null` | Soft-delete timestamp (null = active) |

**Special rows:**
- `u_everyone` / `*` — Built-in anonymous user with role `'anonymous'`.

### `user_access`

Per-user, per-topic access control rules.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | TEXT | | FK to `user.id` (CASCADE delete) |
| `topic` | TEXT | | Topic name (supports `*` wildcard) |
| `read_access` | INTEGER | `0` | Read permission (boolean) |
| `write_access` | INTEGER | `0` | Write permission (boolean) |
| `owner_user_id` | TEXT | `null` | Topic owner user ID |
| `provisioned` | INTEGER | `0` | Admin-created flag |

**PK**: `(user_id, topic)`

If no row exists for a user+topic, both read and write are permitted (open access). Wildcard matching supports `*` patterns.

### `user_token`

Authentication tokens for API access.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | TEXT | | FK to `user.id` (CASCADE delete) |
| `token` | TEXT UNIQUE | | 64-char hex token string |
| `label` | TEXT | `''` | Human-readable label |
| `last_access` | INTEGER | `0` | Last-used timestamp |
| `last_origin` | TEXT | `''` | Last-used origin |
| `expires` | INTEGER | `0` | Expiration timestamp (0 = never) |
| `provisioned` | INTEGER | `0` | Admin-created flag |

**PK**: `(user_id, token)`

### `user_phone`

Phone numbers associated with a user account.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | TEXT | | FK to `user.id` (CASCADE delete) |
| `phone_number` | TEXT | | Phone number string |

**PK**: `(user_id, phone_number)`

### `user_email`

Email addresses associated with a user account.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `user_id` | TEXT | | FK to `user.id` (CASCADE delete) |
| `email` | TEXT | | Email address |
| `is_primary` | INTEGER | `0` | Primary email flag (boolean) |

**PK**: `(user_id, email)`

### `user_magic_link`

One-time authentication tokens for passwordless login and password reset.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `token_hash` | TEXT PK | | Hashed magic link token |
| `kind` | TEXT | | Token purpose (e.g. `login`, `password_reset`) |
| `user_id` | TEXT | | FK to `user.id` (CASCADE delete) |
| `email` | TEXT | `null` | Associated email |
| `expires` | INTEGER | | Expiration timestamp |
| `created` | INTEGER | | Creation timestamp |

### `webpush_subscription`

Web Push subscription endpoint data, one per browser/device.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | | Random subscription ID |
| `endpoint` | TEXT UNIQUE | | Push service endpoint URL |
| `key_auth` | TEXT | | Auth secret (base64url) |
| `key_p256dh` | TEXT | | P-256 public key (base64url) |
| `user_id` | TEXT | | User ID of subscriber |
| `subscriber_ip` | TEXT | | IP address at subscription time |
| `updated_at` | INTEGER | | Last update timestamp |
| `warned_at` | INTEGER | `0` | Last expiry warning timestamp |

### `webpush_subscription_topic`

Many-to-many mapping between subscriptions and topics.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `subscription_id` | TEXT | | FK to `webpush_subscription.id` (CASCADE delete) |
| `topic` | TEXT | | Topic name to receive push for |

**PK**: `(subscription_id, topic)`

### `schema_version`

Migration tracking table.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `store` | TEXT PK | | Namespace (currently `"main"`) |
| `version` | INTEGER | | Schema version number |

---

## Missing Tables (vs original ntfy)

| Table | Original | ntfy-cf | Impact |
|-------|----------|---------|--------|
| `auth_failure` | ✅ | ❌ | No brute-force protection on login |
| `fcm_subscription` | ✅ | ❌ | FCM subscriptions not persisted to DB |
| `fcm_subscription_topic` | ✅ | ❌ | No topic-to-FCM mapping in DB |

---

## Migration Strategy

ntfy-cf uses a simple inline migration approach rather than a formal migration framework:

1. **Schema definition** lives in `worker/src/db.ts` as the `SCHEMA_SQL` constant.
2. **On each request**, the handler calls `initDatabase()`, which checks if `schema_version` exists and has a version for `store = 'main'`.
3. **First run** — if no row exists, the entire `SCHEMA_SQL` is executed statement by statement, then the version is recorded.
4. **Subsequent runs** — the version check passes immediately and no DDL is executed.
5. **Future migrations** — a new version check is added: compare current version, apply incremental DDL, and bump the version.

Current schema version: **4**

---

## Key Relationships

```
user (id) ──────────< user_token (user_id)
user (id) ──────────< user_access (user_id)
user (id) ──────────< user_phone (user_id)
user (id) ──────────< user_email (user_id)
user (id) ──────────< user_magic_link (user_id)
user (id) ──────────< messages (user_id)
tier (id) ──────────< user (tier_id)

webpush_subscription (id) ──< webpush_subscription_topic (subscription_id)
```

All foreign key relationships on user tables use `ON DELETE CASCADE`.
