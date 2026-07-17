import { initDatabase } from '../db'

export async function handleScheduledCleanup(db: D1Database, attachments: R2Bucket): Promise<{ messagesDeleted: number; attachmentsDeleted: number; magicLinksDeleted: number }> {
  await initDatabase(db)
  const now = Math.floor(Date.now() / 1000)

  const expiredAttachments = await db.prepare(
    "SELECT id, attachment_name, attachment_url FROM messages WHERE attachment_url != '' AND attachment_expires > 0 AND attachment_expires < ?"
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
      } catch {}
    }
  }

  const msgResult = await db.prepare(
    "DELETE FROM messages WHERE expires > 0 AND expires < ?"
  ).bind(now).run()
  const messagesDeleted = msgResult.meta.changes ?? 0

  const magicResult = await db.prepare(
    "DELETE FROM user_magic_link WHERE expires < ?"
  ).bind(now).run()
  const magicLinksDeleted = magicResult.meta.changes ?? 0

  return { messagesDeleted, attachmentsDeleted, magicLinksDeleted }
}
