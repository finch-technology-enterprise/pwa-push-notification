export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS messages (
    id                  TEXT PRIMARY KEY,
    sequence_id         TEXT NOT NULL,
    time                INTEGER NOT NULL,
    event               TEXT NOT NULL,
    expires             INTEGER NOT NULL DEFAULT 0,
    topic               TEXT NOT NULL,
    message             TEXT NOT NULL DEFAULT '',
    title               TEXT NOT NULL DEFAULT '',
    priority            INTEGER NOT NULL DEFAULT 3,
    tags                TEXT NOT NULL DEFAULT '',
    click               TEXT NOT NULL DEFAULT '',
    icon                TEXT NOT NULL DEFAULT '',
    actions             TEXT NOT NULL DEFAULT '[]',
    attachment_name     TEXT NOT NULL DEFAULT '',
    attachment_type     TEXT NOT NULL DEFAULT '',
    attachment_size     INTEGER NOT NULL DEFAULT 0,
    attachment_expires  INTEGER NOT NULL DEFAULT 0,
    attachment_url      TEXT NOT NULL DEFAULT '',
    attachment_deleted  INTEGER NOT NULL DEFAULT 0,
    sender              TEXT NOT NULL DEFAULT '',
    user_id             TEXT NOT NULL DEFAULT '',
    content_type        TEXT NOT NULL DEFAULT '',
    encoding            TEXT NOT NULL DEFAULT '',
    published           INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_messages_topic ON messages(topic);
CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(time);
CREATE INDEX IF NOT EXISTS idx_messages_expires ON messages(expires);
CREATE INDEX IF NOT EXISTS idx_messages_topic_time ON messages(topic, time DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sequence_id ON messages(sequence_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_attachment_expires ON messages(attachment_expires);

CREATE TABLE IF NOT EXISTS message_stats (
    key   TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO message_stats (key, value) VALUES ('messages', 0);

CREATE TABLE IF NOT EXISTS tier (
    id                          TEXT PRIMARY KEY,
    code                        TEXT NOT NULL UNIQUE,
    name                        TEXT NOT NULL,
    messages_limit              INTEGER NOT NULL DEFAULT 0,
    messages_expiry_duration    INTEGER NOT NULL DEFAULT 0,
    emails_limit                INTEGER NOT NULL DEFAULT 0,
    calls_limit                 INTEGER NOT NULL DEFAULT 0,
    reservations_limit          INTEGER NOT NULL DEFAULT 0,
    attachment_file_size_limit  INTEGER NOT NULL DEFAULT 0,
    attachment_total_size_limit INTEGER NOT NULL DEFAULT 0,
    attachment_expiry_duration  INTEGER NOT NULL DEFAULT 0,
    attachment_bandwidth_limit  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user (
    id                  TEXT PRIMARY KEY,
    tier_id             TEXT,
    user_name           TEXT NOT NULL UNIQUE,
    pass                TEXT NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('anonymous', 'admin', 'user')),
    prefs               TEXT NOT NULL DEFAULT '{}',
    sync_topic          TEXT NOT NULL DEFAULT '',
    provisioned         INTEGER NOT NULL DEFAULT 0,
    stats_messages      INTEGER NOT NULL DEFAULT 0,
    stats_emails        INTEGER NOT NULL DEFAULT 0,
    stats_calls         INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id  TEXT,
    stripe_subscription_id TEXT,
    created             INTEGER NOT NULL,
    deleted             INTEGER,
    FOREIGN KEY (tier_id) REFERENCES tier(id)
);
CREATE INDEX IF NOT EXISTS idx_user_name ON user(user_name);

INSERT OR IGNORE INTO user (id, user_name, pass, role, sync_topic, provisioned, created)
VALUES ('u_everyone', '*', '', 'anonymous', '', 0, 0);

CREATE TABLE IF NOT EXISTS user_access (
    user_id       TEXT NOT NULL,
    topic         TEXT NOT NULL,
    read_access   INTEGER NOT NULL DEFAULT 0,
    write_access  INTEGER NOT NULL DEFAULT 0,
    owner_user_id TEXT,
    provisioned   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, topic),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_token (
    user_id     TEXT NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    label       TEXT NOT NULL DEFAULT '',
    last_access INTEGER NOT NULL DEFAULT 0,
    last_origin TEXT NOT NULL DEFAULT '',
    expires     INTEGER NOT NULL DEFAULT 0,
    provisioned INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, token),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_token_token ON user_token(token);

CREATE TABLE IF NOT EXISTS user_phone (
    user_id      TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    PRIMARY KEY (user_id, phone_number),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_email (
    user_id    TEXT NOT NULL,
    email      TEXT NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, email),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_magic_link (
    token_hash TEXT PRIMARY KEY,
    kind       TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    email      TEXT,
    expires    INTEGER NOT NULL,
    created    INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_magic_link_user_kind ON user_magic_link(user_id, kind);

CREATE TABLE IF NOT EXISTS webpush_subscription (
    id            TEXT PRIMARY KEY,
    endpoint      TEXT NOT NULL UNIQUE,
    key_auth      TEXT NOT NULL,
    key_p256dh    TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    subscriber_ip TEXT NOT NULL,
    updated_at    INTEGER NOT NULL,
    warned_at     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wp_subscriber_ip ON webpush_subscription(subscriber_ip);

CREATE TABLE IF NOT EXISTS webpush_subscription_topic (
    subscription_id TEXT NOT NULL,
    topic           TEXT NOT NULL,
    PRIMARY KEY (subscription_id, topic),
    FOREIGN KEY (subscription_id) REFERENCES webpush_subscription(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wp_topic ON webpush_subscription_topic(topic);

CREATE TABLE IF NOT EXISTS fcm_subscription (
    id          TEXT PRIMARY KEY,
    token       TEXT NOT NULL UNIQUE,
    user_id     TEXT NOT NULL,
    subscriber_ip TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS fcm_subscription_topic (
    subscription_id TEXT NOT NULL,
    topic           TEXT NOT NULL,
    PRIMARY KEY (subscription_id, topic),
    FOREIGN KEY (subscription_id) REFERENCES fcm_subscription(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fcm_topic ON fcm_subscription_topic(topic);

CREATE TABLE IF NOT EXISTS auth_failure (
    ip        TEXT NOT NULL,
    failed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_failure_ip ON auth_failure(ip);
CREATE INDEX IF NOT EXISTS idx_auth_failure_failed_at ON auth_failure(failed_at);

CREATE TABLE IF NOT EXISTS rate_limit (
    ip        TEXT NOT NULL,
    tier      TEXT NOT NULL DEFAULT 'default',
    tokens    REAL NOT NULL DEFAULT 60,
    last_refill INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ip, tier)
);

CREATE TABLE IF NOT EXISTS schema_version (
    store   TEXT PRIMARY KEY,
    version INTEGER NOT NULL
);
`

export interface DbMessage {
  id: string
  sequence_id: string
  time: number
  event: string
  expires: number
  scheduled_for: number
  topic: string
  message: string
  title: string
  priority: number
  tags: string
  click: string
  icon: string
  actions: string
  attachment_name: string
  attachment_type: string
  attachment_size: number
  attachment_expires: number
  attachment_url: string
  sender: string
  user_id: string
  content_type: string
  encoding: string
  published: number
}

export interface DbUser {
  id: string
  tier_id: string | null
  user_name: string
  pass: string
  role: string
  prefs: string
  sync_topic: string
  provisioned: number
  stats_messages: number
  stats_emails: number
  stats_calls: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created: number
  deleted: number | null
}

export interface DbToken {
  user_id: string
  token: string
  label: string
  last_access: number
  last_origin: string
  expires: number
  provisioned: number
}

export async function initDatabase(db: D1Database): Promise<void> {
  let existing: { version: number } | null = null
  try {
    existing = await db.prepare("SELECT version FROM schema_version WHERE store = 'main'").first<{ version: number }>()
  } catch {
    // schema_version table doesn't exist yet — proceed to create all tables
  }
  if (!existing) {
    const statements = SCHEMA_SQL.split(';').filter(s => s.trim().length > 0)
    for (const stmt of statements) {
      await db.prepare(stmt + ';').run()
    }
    await db.prepare("INSERT INTO schema_version (store, version) VALUES ('main', 1)").run()
    existing = { version: 1 }
  }

  if (existing.version === 1) {
    try {
      await db.prepare("ALTER TABLE messages ADD COLUMN scheduled_for INTEGER NOT NULL DEFAULT 0").run()
    } catch {
      // Column may already exist from a partial migration
    }
    await db.prepare("UPDATE schema_version SET version = 2 WHERE store = 'main'").run()
  }

  if (existing.version === 2) {
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS fcm_subscription (
          id          TEXT PRIMARY KEY,
          token       TEXT NOT NULL UNIQUE,
          user_id     TEXT NOT NULL,
          subscriber_ip TEXT NOT NULL,
          created_at  INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
        )
      `).run()
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS fcm_subscription_topic (
          subscription_id TEXT NOT NULL,
          topic           TEXT NOT NULL,
          PRIMARY KEY (subscription_id, topic),
          FOREIGN KEY (subscription_id) REFERENCES fcm_subscription(id) ON DELETE CASCADE
        )
      `).run()
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_fcm_topic ON fcm_subscription_topic(topic)").run()
    } catch {}
    await db.prepare("UPDATE schema_version SET version = 3 WHERE store = 'main'").run()
  }

  if (existing.version === 3) {
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS auth_failure (
          ip        TEXT NOT NULL,
          failed_at INTEGER NOT NULL
        )
      `).run()
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_failure_ip ON auth_failure(ip)").run()
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_auth_failure_failed_at ON auth_failure(failed_at)").run()
    } catch {}
    await db.prepare("UPDATE schema_version SET version = 4 WHERE store = 'main'").run()
  }

  if (existing.version === 4) {
    try {
      await db.prepare("ALTER TABLE messages ADD COLUMN attachment_deleted INTEGER NOT NULL DEFAULT 0").run()
    } catch {}
    try {
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_sequence_id ON messages(sequence_id)").run()
    } catch {}
    try {
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender)").run()
    } catch {}
    try {
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)").run()
    } catch {}
    try {
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_messages_attachment_expires ON messages(attachment_expires)").run()
    } catch {}
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS rate_limit (
          ip        TEXT NOT NULL,
          tier      TEXT NOT NULL DEFAULT 'default',
          tokens    REAL NOT NULL DEFAULT 60,
          last_refill INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (ip, tier)
        )
      `).run()
    } catch {}
    await db.prepare("UPDATE schema_version SET version = 5 WHERE store = 'main'").run()
  }
}

export async function getStats(db: D1Database): Promise<{ messages: number }> {
  const row = await db.prepare("SELECT value FROM message_stats WHERE key = 'messages'").first<{ value: number }>()
  return { messages: row?.value ?? 0 }
}

export async function incrementMessages(db: D1Database): Promise<void> {
  await db.prepare("UPDATE message_stats SET value = value + 1 WHERE key = 'messages'").run()
}
