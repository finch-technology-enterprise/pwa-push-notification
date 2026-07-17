import { initDatabase } from '../db'

const BATCH_SIZE = 100

export async function handleScheduledCleanup(db: D1Database, attachments: R2Bucket): Promise<{ messagesDeleted: number; attachmentsDeleted: number; magicLinksDeleted: number }> {
  await initDatabase(db)
  const now = Math.floor(Date.now() / 1000)

  const expiredAttachments = await db.prepare(
    "SELECT id, attachment_url FROM messages WHERE attachment_url != '' AND attachment_expires > 0 AND attachment_expires < ?"
  ).bind(now).all()

  let attachmentsDeleted = 0
  for (const row of (expiredAttachments.results ?? []) as any[]) {
    const url = row.attachment_url as string
    const match = url.match(/\/file\/([^/]+)\/([^/]+)$/)
    if (match) {
      const key = `attachments/${match[1]!}/${match[2]!}`
      try {
        await attachments.delete(key)
        attachmentsDeleted++
      } catch (e) {
        console.error('[Cleanup] Failed to delete attachment', key, e)
      }
    }
  }

  let messagesDeleted = 0
  let done = false
  while (!done) {
    const batchResult = await db.prepare(
      "DELETE FROM messages WHERE id IN (SELECT id FROM messages WHERE expires > 0 AND expires < ? LIMIT ?)"
    ).bind(now, BATCH_SIZE).run()
    const deleted = batchResult.meta.changes ?? 0
    messagesDeleted += deleted
    if (deleted < BATCH_SIZE) done = true
  }

  let magicLinksDeleted = 0
  done = false
  while (!done) {
    const batchResult = await db.prepare(
      "DELETE FROM user_magic_link WHERE token_hash IN (SELECT token_hash FROM user_magic_link WHERE expires < ? LIMIT ?)"
    ).bind(now, BATCH_SIZE).run()

    const deleted = batchResult.meta.changes ?? 0
    magicLinksDeleted += deleted
    if (deleted < BATCH_SIZE) done = true
  }

  return { messagesDeleted, attachmentsDeleted, magicLinksDeleted }
}
