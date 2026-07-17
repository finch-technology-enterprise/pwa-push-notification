export interface RateLimitResult {
  allowed: boolean
  limit: number
  current: number
  error?: string
}

export async function checkMessageDailyLimit(
  db: D1Database, userId: string, envLimit: string, tierId?: string | null,
): Promise<RateLimitResult> {
  const tierLimit = tierId ? await getTierIntLimit(db, tierId, 'messages_limit') : null
  const limit = (tierLimit ?? parseInt(envLimit || '0', 10))
  if (limit <= 0) return { allowed: true, limit, current: 0 }

  const dayStart = Math.floor(Date.now() / 86400000) * 86400
  const count = await db.prepare(
    'SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND time >= ?'
  ).bind(userId, dayStart).first<{ cnt: number }>()
  const current = count?.cnt ?? 0

  return {
    allowed: current < limit,
    limit, current,
    error: `Message limit of ${limit} reached`,
  }
}

export async function checkSubscriptionLimit(
  db: D1Database, ip: string, envLimit: string, tierId?: string | null,
): Promise<RateLimitResult> {
  const tierLimit = tierId ? await getTierIntLimit(db, tierId, 'reservations_limit') : null
  const limit = (tierLimit ?? parseInt(envLimit || '30', 10))
  if (limit <= 0) return { allowed: true, limit, current: 0 }

  const count = await db.prepare(
    'SELECT COUNT(*) as cnt FROM webpush_subscription WHERE subscriber_ip = ?'
  ).bind(ip).first<{ cnt: number }>()
  const current = count?.cnt ?? 0

  return {
    allowed: current < limit,
    limit, current,
    error: `Subscription limit of ${limit} reached`,
  }
}

export async function checkAttachmentTotalLimit(
  db: D1Database, userId: string, newSize: number, envLimit: string, tierId?: string | null,
): Promise<RateLimitResult> {
  const tierLimit = tierId ? await getTierIntLimit(db, tierId, 'attachment_total_size_limit') : null
  const limit = (tierLimit ?? parseInt(envLimit || '52428800', 10))
  if (limit <= 0) return { allowed: true, limit, current: 0 }

  const totalRes = await db.prepare(
    'SELECT COALESCE(SUM(attachment_size), 0) as total FROM messages WHERE user_id = ?'
  ).bind(userId).first() as { total: number } | null
  const current = (totalRes?.total ?? 0) + newSize

  return {
    allowed: current <= limit,
    limit, current,
    error: `Total attachment size limit of ${limit} bytes exceeded`,
  }
}

export async function checkAuthRateLimit(db: D1Database, ip: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const window = 900
  const maxAttempts = 5
  const cutoff = Math.floor(Date.now() / 1000) - window

  await db.prepare("DELETE FROM auth_failure WHERE failed_at < ?").bind(cutoff).run()

  const count = await db.prepare(
    "SELECT COUNT(*) as cnt FROM auth_failure WHERE ip = ? AND failed_at >= ?"
  ).bind(ip, cutoff).first<{ cnt: number }>()

  const current = count?.cnt ?? 0
  return { allowed: current < maxAttempts, retryAfter: window }
}

export async function recordAuthFailure(db: D1Database, ip: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  await db.prepare("INSERT INTO auth_failure (ip, failed_at) VALUES (?, ?)").bind(ip, now).run()
}

const TIER_FIELDS = new Set([
  'messages_limit', 'emails_limit', 'calls_limit', 'reservations_limit',
  'attachment_file_size_limit', 'attachment_total_size_limit',
  'attachment_expiry_duration', 'attachment_bandwidth_limit',
])

async function getTierIntLimit(db: D1Database, tierId: string, field: string): Promise<number | null> {
  if (!TIER_FIELDS.has(field)) return null
  try {
    const row = await db.prepare(
      `SELECT ${field} as val FROM tier WHERE id = ?`
    ).bind(tierId).first<{ val: number }>()
    return row?.val ?? null
  } catch {
    return null
  }
}
