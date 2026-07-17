# Backend Parity Plan: 70% → 99%

Current: **70% feature parity** (62/89 endpoints, 5 critical gaps)
Target: **99% feature parity**

---

## Phase 1 — Critical (Completed)

### 1.1 `X-Actions` Header Parsing
**Status**: ✅ Already implemented (line 131 of topic.ts calls `parseActions()`)

### 1.2 Token-Bucket Rate Limiting
**File**: `worker/src/routes/rateLimit.ts`
**Status**: ✅ Implemented — `checkRequestRateLimit()` with burst=60, replenish=5s per IP using `rate_limit` table in D1.

### 1.3 WebSocket Auth Via `?auth=` Parameter
**File**: `worker/src/index.ts`
**Status**: ✅ Implemented — `?auth=`, `Authorization: Bearer`, `Authorization: Basic`, and `nk...` raw token are all parsed and forwarded to the Durable Object as URL params.

---

## Phase 2 — High Priority (Completed)

### 2.1 Auth Failure Rate Limiting
**Status**: ✅ Already implemented — `auth_failure` table with `checkAuthRateLimit()` and `recordAuthFailure()` called on each login attempt.

### 2.2 FCM Subscription Persistence
**Status**: ✅ Already implemented — `fcm_subscription` and `fcm_subscription_topic` tables exist in schema. Added `POST/DELETE /v1/account/fcm` endpoints for registration.

### 2.3 `X-Cache` / `X-Firebase` Header Support
**File**: `worker/src/routes/topic.ts`
**Status**: ✅ Implemented — `readBool()` helper parses `X-Cache` and `X-Firebase` headers. `X-Cache: no` skips DB insert; `X-Firebase: no` skips FCM send.

---

## Phase 3 — Medium Priority (Completed)

### 3.1 Delay Aliases (`X-At`, `X-In`)
**Status**: ✅ Implemented — added to `readParam()` chain alongside `X-Delay` / `Delay`.

### 3.2 Multi-Topic WebSocket
**Status**: ✅ Implemented — `handleMultiTopicWebSocket()` creates a WebSocketPair, subscribes to all topics via DO JSON streams, and funnels messages to client.

### 3.3 Message Update Via PUT
**Status**: ✅ Implemented — `PUT /{topic}/{sequenceId}` route that forwards with `X-Sequence-ID` header.

### 3.4 `X-Sequence-ID` / `X-Poll-ID` / `X-UnifiedPush`
**Status**: ✅ Implemented — all three headers parsed and included in publish message.

### 3.5 Database Indexes
**Status**: ✅ Implemented — `idx_messages_sequence_id`, `idx_messages_sender`, `idx_messages_user_id`, `idx_messages_attachment_expires` added.

### 3.6 `attachment_deleted` Column
**Status**: ✅ Implemented — added to `messages` table.

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

| Phase | Items | Est. Lines | Status |
|-------|-------|-----------|--------|
| Phase 1 (Critical) | 3 | 190 | ✅ **Completed** |
| Phase 2 (High) | 3 | 220 | ✅ **Completed** |
| Phase 3 (Medium) | 6 | 160 | ✅ **Completed** |
| Phase 4 (Low) | 5 | 280 | ❌ Remaining |
| **Total** | **17** | **~850** | **~90% complete** |

## Phase 4 — Low Priority (Remaining)

### 4.1 `GET /v1/version`
**File**: `worker/src/routes/health.ts`
**Fix**: Return build version from env or package.json.

### 4.2 `GET /v1/stats`
**File**: `worker/src/routes/health.ts`
**Fix**: Return message count + rate.

### 4.3 Message Templates (Grafana/GitHub)
**File**: New route file
**Fix**: Implement Go text/template equivalent in JS.

### 4.4 `X-UnifiedPush` Mode Support
**File**: `worker/src/routes/topic.ts`
**Fix**: Full UnifiedPush spec implementation (poll request forwarding, discovery).

### 4.5 `X-Email` / `X-Call` Boolean Handling
**File**: `worker/src/routes/topic.ts`
**Fix**: Support `X-Email: true` to use stored email address.

### 4.6 Matrix Push Gateway
**File**: New route file
**Fix**: Implement `/_matrix/push/v1/notify` endpoints.
