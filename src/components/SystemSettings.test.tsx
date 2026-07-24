import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemSettings from './SystemSettings';

const authState = vi.hoisted(() => ({
  profile: {
    user_id: 'super-admin-1',
    role: 'super_admin',
  },
}));

const tableApi = vi.hoisted(() => ({
  count: vi.fn(async () => ({ count: 1 })),
  list: vi.fn(async () => []),
  create: vi.fn(async () => ({})),
  update: vi.fn(async () => ({})),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: authState.profile }),
}));

vi.mock('@/hooks/useFeatureAccess', () => ({
  useFeatureAccess: () => ({
    canFull: (feature: string) => feature === 'system_settings.manage',
  }),
}));

vi.mock('@/integrations/backend/provider', () => ({
  isPhpBackend: true,
}));

vi.mock('@/integrations/php-api/client', () => ({
  phpApi: {
    table: () => tableApi,
  },
}));

describe('SystemSettings refresh stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not visibly shift or reload when the auth profile object is refreshed', async () => {
    const { rerender } = render(<SystemSettings />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(tableApi.count).toHaveBeenCalledTimes(6);
    expect(screen.getByRole('status')).toHaveClass('sr-only');
    expect(screen.getByRole('status')).toHaveTextContent('System data is current');

    authState.profile = { ...authState.profile };
    rerender(<SystemSettings />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(tableApi.count).toHaveBeenCalledTimes(6);
    expect(screen.getByRole('status')).toHaveClass('sr-only');
  });
});
