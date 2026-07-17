import type { PublishMessage } from '../types'

export async function sendPhoneNotifications(
  db: D1Database,
  topic: string,
  msg: PublishMessage,
  twilioAccountSid?: string,
  twilioAuthToken?: string,
  twilioFromNumber?: string,
): Promise<void> {
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) return

  const phones = await db.prepare(
    'SELECT p.phone_number FROM user_phone p JOIN user_access a ON a.user_id = p.user_id WHERE a.topic = ? AND a.read_access = 1'
  ).bind(topic).all()

  if (!phones.results || phones.results.length === 0) return

  const message = msg.message || msg.title || 'Notification from PWA Push'
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${escapeXml(message)}</Say></Response>`

  const auth = btoa(`${twilioAccountSid}:${twilioAuthToken}`)

  for (const row of phones.results) {
    const phoneNumber = (row as any).phone_number as string
    try {
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: twilioFromNumber,
          Twiml: twiml,
        }).toString(),
      })
    } catch {}
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
