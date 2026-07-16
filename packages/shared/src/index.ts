export const DISALLOWED_TOPICS_DEFAULT = [
  'docs', 'static', 'file', 'app', 'metrics', 'account',
  'settings', 'signup', 'login', 'v1',
] as const;

export const TOPIC_REGEX = /^[-_A-Za-z0-9]{1,64}$/;
export const TOPIC_PATH_REGEX = /^\/[-_A-Za-z0-9]{1,64}$/;
export const MESSAGE_ID_LENGTH = 12;

export type EventType = 'open' | 'keepalive' | 'message' | 'message_delete' | 'message_clear' | 'poll_request';
export type Priority = 1 | 2 | 3 | 4 | 5;
export type UserRole = 'anonymous' | 'admin' | 'user';
export type Permission = 'read-write' | 'read-only' | 'write-only' | 'deny-all';

export interface Message {
  id: string;
  sequence_id?: string;
  time: number;
  expires?: number;
  event: EventType;
  topic: string;
  title?: string;
  message?: string;
  priority?: Priority;
  tags?: string[];
  click?: string;
  icon?: string;
  actions?: Action[];
  attachment?: Attachment;
  poll_id?: string;
  content_type?: string;
  encoding?: string;
}

export interface Attachment {
  name: string;
  type?: string;
  size?: number;
  expires?: number;
  url: string;
}

export interface Action {
  id: string;
  action: 'view' | 'broadcast' | 'http' | 'copy';
  label: string;
  clear?: boolean;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  intent?: string;
  extras?: Record<string, string>;
  value?: string;
}

export interface SinceMarker {
  time?: number;
  id?: string;
}

export interface User {
  id: string;
  user: string;
  role: UserRole;
  prefs: Record<string, unknown>;
  sync_topic: string;
  created: number;
  tier?: Tier;
  email?: string;
  phone?: string;
}

export interface Tier {
  id: string;
  code: string;
  name: string;
  messages_limit: number;
  messages_expiry_duration: number;
  emails_limit: number;
  calls_limit: number;
  reservations_limit: number;
  attachment_file_size_limit: number;
  attachment_total_size_limit: number;
  attachment_expiry_duration: number;
  attachment_bandwidth_limit: number;
}

export interface WebPushSubscription {
  id: string;
  endpoint: string;
  key_auth: string;
  key_p256dh: string;
  user_id: string;
  topics: string[];
  updated_at: number;
}

export interface Account {
  id: string;
  user: string;
  role: UserRole;
  prefs: Record<string, unknown>;
  sync_topic: string;
  created: number;
  tier?: Tier;
  emails?: string[];
  phone_numbers?: string[];
  subscriptions?: AccountSubscription[];
  reservations?: AccountReservation[];
}

export interface AccountSubscription {
  id?: string;
  topic: string;
  base_url?: string;
}

export interface AccountReservation {
  id: string;
  topic: string;
  permission: Permission;
}

export interface ApiError {
  code: number;
  http_code: number;
  error: string;
  link: string;
}

export interface ApiSuccess {
  success: true;
}

export interface ApiHealth {
  healthy: boolean;
}

export interface ApiStats {
  messages: number;
  messages_rate: number;
}

export interface ApiConfig {
  'base-url': string;
  'app-root': string;
  'enable-signup': boolean;
  'enable-login': boolean;
  'enable-reservations': boolean;
  'enable-payments': boolean;
  'require-login': boolean;
  'web-push-public-key'?: string;
  'disallowed-topics': string[];
  'config-hash': string;
  'visitor-subscription-limit': number;
  'visitor-message-daily-limit': number;
  'message-size-limit': number;
  'keepalive-interval': number;
}
