export type AuthError = {
  message: string;
  name?: string;
  status?: number;
};

export type User = {
  id: string;
  aud?: string;
  role?: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  created_at?: string;
};

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type: string;
  user: User;
};

export type RealtimeChangePayload<T = Record<string, unknown>> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: Partial<T>;
  errors: unknown[] | null;
};

export type RealtimeChannel = {
  topic?: string;
  on: (...args: unknown[]) => RealtimeChannel;
  subscribe: (callback?: (status: string, error?: unknown) => void) => RealtimeChannel | Promise<RealtimeChannel>;
  unsubscribe: () => Promise<'ok'>;
  send: (payload: unknown) => Promise<'ok'>;
  track: (payload: unknown) => Promise<'ok'>;
  presenceState: () => Record<string, unknown>;
};

export type ApiClient<T = unknown> = {
  from: (table: string) => unknown;
  auth: unknown;
  storage: unknown;
  functions: unknown;
  rpc: (name: string, params?: Record<string, unknown>) => Promise<unknown>;
  channel: (name: string, options?: Record<string, unknown>) => RealtimeChannel;
  removeChannel: (channel: RealtimeChannel) => Promise<'ok'>;
  getChannels: () => RealtimeChannel[];
  __database?: T;
};
