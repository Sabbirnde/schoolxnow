import { vi } from 'vitest';

// Mock Supabase client
export const mockSupabase = {
  from: vi.fn((table: string) => mockFromResponse),
  channel: vi.fn(() => mockChannelResponse),
  removeChannel: vi.fn(),
  auth: {
    onAuthStateChange: vi.fn((callback) => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
};

// Mock response for .from(table).select()
export const mockFromResponse = {
  select: vi.fn(function(this: any, fields?: string) {
    return {
      ...mockFromResponse,
      _fields: fields,
    };
  }),
  insert: vi.fn(function(this: any, data: any) {
    return Promise.resolve({ data, error: null });
  }),
  update: vi.fn(function(this: any, data: any) {
    return {
      eq: vi.fn(() => Promise.resolve({ data, error: null })),
    };
  }),
  delete: vi.fn(function(this: any) {
    return {
      eq: vi.fn(() => Promise.resolve({ error: null })),
    };
  }),
  eq: vi.fn(function(this: any, column: string, value: any) {
    return Promise.resolve({ data: [], error: null });
  }),
  order: vi.fn(function(this: any, column: string, options?: any) {
    return mockFromResponse;
  }),
  limit: vi.fn(function(this: any, count: number) {
    return Promise.resolve({ data: [], error: null });
  }),
  gte: vi.fn(function(this: any, column: string, value: any) {
    return mockFromResponse;
  }),
  lt: vi.fn(function(this: any, column: string, value: any) {
    return Promise.resolve({ data: [], error: null, count: 0 });
  }),
  maybeSingle: vi.fn(function(this: any) {
    return Promise.resolve({ data: null, error: null });
  }),
  single: vi.fn(function(this: any) {
    return Promise.resolve({ data: null, error: null });
  }),
  subscribe: vi.fn(function(this: any, event?: string | null, callback?: any) {
    return { unsubscribe: vi.fn() };
  }),
};

// Make the mock chainable by returning new instances when needed
Object.assign(mockFromResponse, {
  select: vi.fn(() => ({ ...mockFromResponse })),
  order: vi.fn(() => ({ ...mockFromResponse })),
});

// Mock channel response for real-time subscriptions
export const mockChannelResponse = {
  on: vi.fn(function(this: any, event: string, options: any, callback: any) {
    return this;
  }),
  subscribe: vi.fn(function(this: any, callback?: (status: string) => void) {
    if (callback) callback('SUBSCRIBED');
    return this;
  }),
  unsubscribe: vi.fn(),
};

// Mock useToast hook
export const mockToast = vi.fn();
export const mockUseToast = () => ({
  toast: mockToast,
});

// Mock useAuth hook
export const mockUseAuth = () => ({
  user: {
    id: 'test-user-id',
    email: 'admin@test.com',
  },
  profile: {
    user_id: 'test-user-id',
    full_name: 'Test Admin',
    role: 'super_admin',
    school_id: null,
  },
  loading: false,
  error: null,
  signOut: vi.fn(),
});

// Mock useFeatureAccess hook
export const mockUseFeatureAccess = () => ({
  can: (feature: string, level?: string) => true,
  canFull: (feature: string) => true,
  isAllowed: (features: string[]) => true,
});
