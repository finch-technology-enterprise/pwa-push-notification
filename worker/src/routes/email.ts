export interface EmailOptions {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  from: { email: string; name?: string }
  replyTo?: string
  subject: string
  html?: string
  text?: string
  headers?: Record<string, string>
}

export async function sendEmail(
  emailBinding: any,
  options: EmailOptions,
): Promise<string | null> {
  if (!emailBinding || typeof emailBinding.send !== 'function') {
    console.warn('Email binding not available')
    return null
  }

  try {
    const response = await emailBinding.send(options)
    return response?.messageId || null
  } catch (err: any) {
    console.error(`Email send failed: ${err?.code || err?.message || err}`)
    return null
  }
}
