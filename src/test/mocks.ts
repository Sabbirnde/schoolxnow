import { vi } from 'vitest';

// Mock Api client
export const mockApi = {
  from: vi.fn((table: string) => mockFromResponse),
  channel: vi.fn(() => mockChannelResponse),
  removeChannel: vi.fn(),
  auth: {
    onAuthStateChange: vi.fn((_callback: unknown) => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
};

// Mock response for .from(table).select()
export const mockFromResponse = {
  select: vi.fn((fields?: string) => {
    return {
      ...mockFromResponse,
      _fields: fields,
    };
  }),
  insert: vi.fn((data: unknown) => {
    return Promise.resolve({ data, error: null });
  }),
  update: vi.fn((data: unknown) => {
    return {
      eq: vi.fn(() => Promise.resolve({ data, error: null })),
    };
  }),
  delete: vi.fn(() => {
    return {
      eq: vi.fn(() => Promise.resolve({ error: null })),
    };
  }),
  eq: vi.fn((_column: string, _value: unknown) => {
    return Promise.resolve({ data: [], error: null });
  }),
  order: vi.fn((_column: string, _options?: unknown) => {
    return mockFromResponse;
  }),
  limit: vi.fn((_count: number) => {
    return Promise.resolve({ data: [], error: null });
  }),
  gte: vi.fn((_column: string, _value: unknown) => {
    return mockFromResponse;
  }),
  lt: vi.fn((_column: string, _value: unknown) => {
    return Promise.resolve({ data: [], error: null, count: 0 });
  }),
  maybeSingle: vi.fn(() => {
    return Promise.resolve({ data: null, error: null });
  }),
  single: vi.fn(() => {
    return Promise.resolve({ data: null, error: null });
  }),
  subscribe: vi.fn((_event?: string | null, _callback?: unknown) => {
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
  on: vi.fn((_event: string, _options: unknown, _callback: unknown) => {
    return mockChannelResponse;
  }),
  subscribe: vi.fn((callback?: (status: string) => void) => {
    if (callback) callback('SUBSCRIBED');
    return mockChannelResponse;
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
