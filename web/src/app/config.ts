const win = window as unknown as { config?: Record<string, unknown> }
const cfg = win.config || {}

export const baseUrl = (cfg.base_url as string) || ''
export const appRoot = (cfg.app_root as string) || '/'
export const enableSignup = (cfg.enable_signup as boolean) ?? false
export const enableLogin = (cfg.enable_login as boolean) ?? false
export const enableReservations = (cfg.enable_reservations as boolean) ?? false
export const requireLogin = (cfg.require_login as boolean) ?? false
export const webPushPublicKey = (cfg.web_push_public_key as string) || ''
export const disallowedTopics = (cfg.disallowed_topics as string[]) || []
export const visitorSubscriptionLimit = (cfg.visitor_subscription_limit as number) || 30
export const messageSizeLimit = (cfg.message_size_limit as number) || 4096
export const keepaliveInterval = (cfg.keepalive_interval as number) || 45
