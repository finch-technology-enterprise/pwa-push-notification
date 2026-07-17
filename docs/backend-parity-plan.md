# Backend Parity Plan: 70% → 99%

Current: **70% feature parity** (62/89 endpoints, 5 critical gaps)
Target: **99% feature parity**

---

## Phase 1 — Critical (Do First)

### 1.1 `X-Actions` Header Parsing
**File**: `worker/src/routes/topic.ts:126-134`
**What's missing**: `parseActions()` is defined in middleware but never called from `handlePublish`. The `X-Actions` header is not included in the `readParam()` chain.
**Fix**: Add `X-Actions` to the `readParam()` call chain and call `parseActions()` on the result, like the original does.
**Estimate**: 10 lines
**Dependencies**: None

### 1.2 Token-Bucket Rate Limiting
**File**: `worker/src/routes/rateLimit.ts`
**What's missing**: Original uses token-bucket with burst (60) and replenish (5s) per visitor. Current only has daily message limits.
**Fix**: Implement sliding-window or token-bucket rate limiter using D1 or DO storage. Track per-IP and per-user.
**Estimate**: 150 lines
**Dependencies**: Storage layer for rate limit state

### 1.3 WebSocket Auth Via `?auth=` Parameter
**File**: `worker/src/index.ts:107-124`
**What's missing**: When upgrading WebSocket, auth credentials from `?auth=` query param are not parsed or forwarded to the DO.
**Fix**: Parse `?auth=` param before WS upgrade, validate via `authenticate()`, pass user context to DO via URL param or header.
**Estimate**: 30 lines
**Dependencies**: None

---

## Phase 2 — High Priority

### 2.1 Auth Failure Rate Limiting
**Files**: `worker/migrations/0001_initial.sql`, `worker/src/routes/account.ts`
**What's missing**: No `auth_failure` table, no tracking of failed login attempts.
**Fix**: Add `auth_failure` table (user_id/timestamp), check before login, prune old entries.
**Estimate**: 80 lines
**Dependencies**: DB migration

### 2.2 FCM Subscription Persistence
**Files**: `worker/migrations/0001_initial.sql`, `worker/src/routes/fcm.ts`
**What's missing**: FCM subscriptions are sent to Firebase but never stored in DB. Original has `fcm_subscription` + `fcm_subscription_topic` tables.
**Fix**: Add FCM tables, store subscriptions on register, query on publish.
**Estimate**: 120 lines
**Dependencies**: DB migration

### 2.3 `X-Cache` / `X-Firebase` Header Support
**File**: `worker/src/routes/topic.ts`
**What's missing**: Original supports `X-Cache: no` to skip caching and `X-Firebase: no` to skip FCM. Current always does both.
**Fix**: Parse booleans from headers, conditionally skip cache insert / FCM send.
**Estimate**: 20 lines
**Dependencies**: None

---

## Phase 3 — Medium Priority

### 3.1 Delay Aliases (`X-At`, `X-In`)
**File**: `worker/src/routes/topic.ts:132`
**What's missing**: Original supports `X-At` (absolute timestamp) and `X-In` (relative duration) as aliases for `X-Delay`.
**Fix**: Add to `readParam()` chain in handlePublish.
**Estimate**: 5 lines
**Dependencies**: None

### 3.2 Multi-Topic WebSocket
**File**: `worker/src/routes/topic.ts:277-279`
**What's missing**: Original supports `GET /topic1,topic2/ws`. Current returns 400.
**Fix**: Implement multi-topic WS by subscribing to multiple DOs from a single WS connection.
**Estimate**: 80 lines
**Dependencies**: Phase 1.3 (WS auth)

### 3.3 Message Update Via PUT
**File**: `worker/src/routes/topic.ts`
**What's missing**: Original supports `PUT /{topic}/{sequenceID}` to update an existing message.
**Fix**: Add route handler that matches update pattern, replaces message in DB + DO.
**Estimate**: 40 lines
**Dependencies**: None

### 3.4 `X-Sequence-ID` / `X-Event` / `X-Poll-ID`
**File**: `worker/src/routes/topic.ts`
**What's missing**: Custom sequence IDs, custom event types, poll request tracking.
**Fix**: Add to `readParam()` chain in handlePublish.
**Estimate**: 20 lines
**Dependencies**: None

### 3.5 Database Indexes
**File**: `worker/migrations/0001_initial.sql`
**What's missing**: `idx_mid`, `idx_sequence_id`, `idx_sender`, `idx_user`, `idx_attachment_expires`.
**Fix**: Add CREATE INDEX statements.
**Estimate**: 10 lines
**Dependencies**: DB migration

### 3.6 `attachment_deleted` Column
**File**: `worker/migrations/0001_initial.sql`
**What's missing**: Original tracks whether attachments are deleted.
**Fix**: Add column to messages table.
**Estimate**: 5 lines
**Dependencies**: DB migration

---

## Phase 4 — Lower Priority

### 4.1 `GET /v1/version`
**File**: `worker/src/routes/health.ts`
**Fix**: Return build version from env or package.json.
**Estimate**: 10 lines

### 4.2 `GET /v1/stats`
**File**: `worker/src/routes/health.ts`
**Fix**: Return message count + rate.
**Estimate**: 15 lines

### 4.3 Message Templates (Grafana/GitHub)
**File**: New route file
**Fix**: Implement Go text/template equivalent in JS.
**Estimate**: 200 lines

### 4.4 `X-UnifiedPush` Support
**File**: `worker/src/routes/topic.ts`
**Fix**: Add UnifiedPush mode header handling.
**Estimate**: 40 lines

### 4.5 `X-Email` / `X-Call` Boolean Handling
**File**: `worker/src/routes/topic.ts`
**Fix**: Support `X-Email: true` to use stored email address.
**Estimate**: 15 lines

---

## Dependency Graph

```
Phase 1.1 (Actions)     ← no deps
Phase 1.2 (Rate limit)  ← no deps
Phase 1.3 (WS auth)     ← no deps
    ↓
Phase 2.1 (Auth fail)   ← DB migration
Phase 2.2 (FCM persist) ← DB migration
Phase 2.3 (Cache/Firebase headers) ← no deps
    ↓
Phase 3.1 (Delay aliases)  ← no deps
Phase 3.2 (Multi WS)       ← Phase 1.3
Phase 3.3 (PUT update)     ← no deps
Phase 3.4 (Sequence/Event) ← no deps
Phase 3.5 (Indexes)        ← DB migration
Phase 3.6 (attachment_deleted) ← DB migration
    ↓
Phase 4.x                 ← no deps
```

## DB Migration Strategy

All DB changes (Phases 2.1, 2.2, 3.5, 3.6) should be a single migration version bump:

```sql
-- Migration v5: parity improvements
CREATE TABLE IF NOT EXISTS auth_failure (...);
CREATE TABLE IF NOT EXISTS fcm_subscription (...);
CREATE TABLE IF NOT EXISTS fcm_subscription_topic (...);
ALTER TABLE messages ADD COLUMN attachment_deleted INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_messages_mid ON messages(id);
CREATE INDEX IF NOT EXISTS idx_messages_sequence_id ON messages(sequence_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_attachment_expires ON messages(attachment_expires);
```

## Effort Summary

| Phase | Items | Est. Lines | Dependencies |
|-------|-------|-----------|-------------|
| Phase 1 (Critical) | 3 | 190 | None |
| Phase 2 (High) | 3 | 220 | DB migration |
| Phase 3 (Medium) | 6 | 160 | Phase 1.3, DB migration |
| Phase 4 (Low) | 5 | 280 | None |
| **Total** | **17** | **~850** | — |
