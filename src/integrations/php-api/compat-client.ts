import { phpApi, type PhpApiUser } from './client';
import type { RealtimeChannel, Session, User } from './compat-types';

type QueryResult<T = unknown> = {
  data: T | null;
  error: Error | null;
  count?: number | null;
};

type FilterValue = string | number | boolean | null;

const currentToken = () => localStorage.getItem(phpApi.tokenKey);

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error || 'Request failed'));
}

function toUser(apiUser: PhpApiUser): User {
  return {
    id: apiUser.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: apiUser.email,
    app_metadata: {},
    user_metadata: {
      full_name: apiUser.full_name,
      role: apiUser.role,
      school_id: apiUser.school_id,
    },
    created_at: '',
  };
}

function toSession(apiUser: PhpApiUser): Session {
  return {
    access_token: currentToken() || '',
    refresh_token: '',
    expires_in: 86400,
    token_type: 'bearer',
    user: toUser(apiUser),
  };
}

function createChannel(topic: string): RealtimeChannel {
  const channel: RealtimeChannel = {
    topic,
    on: () => channel,
    subscribe: (callback) => {
      callback?.('SUBSCRIBED');
      return channel;
    },
    unsubscribe: async () => 'ok',
    send: async () => 'ok',
    track: async () => 'ok',
    presenceState: () => ({}),
  };

  return channel;
}

class PhpQueryBuilder {
  private filters: Record<string, FilterValue> = {};
  private orderColumn: string | null = null;
  private ascending = true;
  private limitCount: number | null = null;
  private offset = 0;
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: unknown = null;
  private wantSingle = false;
  private allowMissingSingle = false;
  private countMode: 'exact' | null = null;
  private headOnly = false;

  constructor(private readonly table: string) {}

  select(_columns = '*', options: { count?: 'exact'; head?: boolean } = {}) {
    this.operation = this.operation === 'select' ? 'select' : this.operation;
    this.countMode = options.count ?? null;
    this.headOnly = Boolean(options.head);
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown) {
    this.operation = 'upsert';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: FilterValue) {
    this.filters[column] = value;
    return this;
  }

  neq(column: string, value: FilterValue) {
    this.filters[`${column}__neq`] = value;
    return this;
  }

  in(column: string, values: FilterValue[]) {
    this.filters[`${column}__in`] = values.join(',');
    return this;
  }

  gte(column: string, value: FilterValue) {
    this.filters[`${column}__gte`] = value;
    return this;
  }

  lte(column: string, value: FilterValue) {
    this.filters[`${column}__lte`] = value;
    return this;
  }

  gt(column: string, value: FilterValue) {
    this.filters[`${column}__gt`] = value;
    return this;
  }

  lt(column: string, value: FilterValue) {
    this.filters[`${column}__lt`] = value;
    return this;
  }

  ilike(column: string, value: string) {
    this.filters[`${column}__like`] = value.replaceAll('%', '');
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderColumn = column;
    this.ascending = options.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.offset = from;
    this.limitCount = Math.max(0, to - from + 1);
    return this;
  }

  single() {
    this.wantSingle = true;
    this.allowMissingSingle = false;
    return this;
  }

  maybeSingle() {
    this.wantSingle = true;
    this.allowMissingSingle = true;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult> {
    try {
      if (this.operation === 'insert') {
        const records = Array.isArray(this.payload) ? this.payload : [this.payload];
        const created = [];
        for (const record of records) {
          created.push(await phpApi.table<Record<string, unknown>>(this.table).create(record as Record<string, unknown>));
        }
        return this.formatRows(created);
      }

      if (this.operation === 'update') {
        const id = this.filters.id;
        if (typeof id === 'string') {
          const updated = await phpApi.table<Record<string, unknown>>(this.table).update(id, this.payload as Record<string, unknown>);
          return this.formatRows([updated]);
        }

        const rows = await this.listRows();
        const updated = [];
        for (const row of rows) {
          if (typeof row.id === 'string') {
            updated.push(await phpApi.table<Record<string, unknown>>(this.table).update(row.id, this.payload as Record<string, unknown>));
          }
        }
        return this.formatRows(updated);
      }

      if (this.operation === 'upsert') {
        const records = Array.isArray(this.payload) ? this.payload : [this.payload];
        const saved = [];
        for (const record of records as Record<string, unknown>[]) {
          if (typeof record.id === 'string') {
            saved.push(await phpApi.table<Record<string, unknown>>(this.table).update(record.id, record));
          } else {
            saved.push(await phpApi.table<Record<string, unknown>>(this.table).create(record));
          }
        }
        return this.formatRows(saved);
      }

      if (this.operation === 'delete') {
        const id = this.filters.id;
        if (typeof id === 'string') {
          await phpApi.table<Record<string, unknown>>(this.table).delete(id);
          return { data: null, error: null };
        }

        const rows = await this.listRows();
        for (const row of rows) {
          if (typeof row.id === 'string') {
            await phpApi.table<Record<string, unknown>>(this.table).delete(row.id);
          }
        }
        return { data: null, error: null };
      }

      if (this.countMode === 'exact' && this.headOnly) {
        const { count } = await phpApi.table<Record<string, unknown>>(this.table).count(this.params());
        return { data: null, error: null, count };
      }

      return this.formatRows(await this.listRows());
    } catch (error) {
      return { data: null, error: toError(error), count: null };
    }
  }

  private async listRows() {
    return phpApi.table<Record<string, unknown>>(this.table).list(this.params());
  }

  private params() {
    return {
      ...this.filters,
      ...(this.orderColumn ? { order: this.orderColumn, ascending: this.ascending } : {}),
      ...(this.limitCount !== null ? { limit: this.limitCount } : {}),
      ...(this.offset ? { offset: this.offset } : {}),
    };
  }

  private formatRows(rows: Record<string, unknown>[]): QueryResult {
    if (this.wantSingle) {
      const row = rows[0] ?? null;
      if (!row && !this.allowMissingSingle) {
        return { data: null, error: new Error('No rows returned'), count: 0 };
      }
      return { data: row, error: null, count: row ? 1 : 0 };
    }

    return { data: rows, error: null, count: rows.length };
  }
}

export const supabase = {
  from(table: string) {
    return new PhpQueryBuilder(table);
  },

  rpc: async (name: string) => {
    try {
      if (name === 'super_admin_exists') {
        const data = await phpApi.bootstrapStatus();
        return { data: data.super_admin_exists, error: null };
      }

      return { data: null, error: new Error(`RPC ${name} is not available in PHP mode`) };
    } catch (error) {
      return { data: null, error: toError(error) };
    }
  },

  auth: {
    async signInWithPassword(input: { email: string; password: string }) {
      try {
        const data = await phpApi.login(input.email, input.password);
        return { data: { user: toUser(data.user), session: toSession(data.user) }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: toError(error) };
      }
    },

    async signUp(input: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      try {
        const data = await phpApi.register({
          email: input.email,
          password: input.password,
          full_name: String(input.options?.data?.full_name || input.email),
          role: typeof input.options?.data?.role === 'string' ? input.options.data.role : undefined,
          school_id: typeof input.options?.data?.school_id === 'string' ? input.options.data.school_id : undefined,
        });
        const user = toUser({
          id: data.id,
          email: data.email,
          full_name: String(input.options?.data?.full_name || input.email),
          role: 'teacher',
          school_id: null,
          is_active: true,
        });
        return { data: { user, session: null }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: toError(error) };
      }
    },

    async signOut() {
      try {
        await phpApi.logout();
        return { error: null };
      } catch (error) {
        return { error: toError(error) };
      }
    },

    async getUser() {
      try {
        const user = await phpApi.me();
        return { data: { user: toUser(user) }, error: null };
      } catch (error) {
        return { data: { user: null }, error: toError(error) };
      }
    },

    async getSession() {
      try {
        const user = await phpApi.me();
        return { data: { session: toSession(user) }, error: null };
      } catch {
        return { data: { session: null }, error: null };
      }
    },

    async refreshSession() {
      return this.getSession();
    },

    async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
      try {
        await phpApi.requestPasswordReset(email, options?.redirectTo);
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error: toError(error) };
      }
    },

    async updateUser(input: { password?: string; data?: Record<string, unknown> }) {
      try {
        if (input.data) {
          await phpApi.updateProfile({
            full_name: String(input.data.full_name || ''),
            avatar_url: typeof input.data.avatar_url === 'string' ? input.data.avatar_url : undefined,
          });
        }
        return { data: { user: null }, error: input.password ? new Error('Use the change password form in PHP mode') : null };
      } catch (error) {
        return { data: { user: null }, error: toError(error) };
      }
    },

    async signInWithOtp(input: { email: string; options?: { emailRedirectTo?: string } }) {
      try {
        await phpApi.requestPasswordReset(input.email, input.options?.emailRedirectTo);
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error: toError(error) };
      }
    },

    async verifyOtp() {
      return { data: { user: null, session: null }, error: new Error('OTP verification is not available in PHP mode') };
    },

    onAuthStateChange() {
      return {
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      };
    },
  },

  functions: {
    async invoke(name: string, options?: { body?: Record<string, unknown> }) {
      try {
        if (name === 'create-super-admin') {
          const data = await phpApi.createSuperAdmin(options?.body as {
            email: string;
            password: string;
            full_name: string;
            secret_key: string;
          });
          return { data, error: null };
        }
        return { data: null, error: new Error(`Function ${name} is not available in PHP mode`) };
      } catch (error) {
        return { data: null, error: toError(error) };
      }
    },
  },

  storage: {
    async listBuckets() {
      return { data: [{ name: 'avatars' }, { name: 'student-photos' }, { name: 'documents' }], error: null };
    },
    from(bucket: 'avatars' | 'student-photos' | 'documents') {
      return {
        async upload(path: string, file: File) {
          try {
            const data = await phpApi.uploadFile(bucket, file);
            return { data: { path: data.filename || path }, error: null };
          } catch (error) {
            return { data: null, error: toError(error) };
          }
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: path } };
        },
        async list() {
          return { data: [], error: null };
        },
        async remove() {
          return { data: [], error: null };
        },
      };
    },
  },

  channel: createChannel,
  removeChannel: async () => 'ok' as const,
  getChannels: () => [] as RealtimeChannel[],
};

export async function checkBackendHealth() {
  try {
    const data = await phpApi.health();
    return {
      healthy: Boolean(data.ok),
      message: data.service,
      timestamp: data.time,
    };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'PHP API health check failed',
      timestamp: new Date().toISOString(),
    };
  }
}
