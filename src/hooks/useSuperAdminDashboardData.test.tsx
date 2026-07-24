import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryState = vi.hoisted(() => ({
  current: {
    data: undefined as any,
    isLoading: true,
    isFetching: true,
    error: null,
    refetch: vi.fn(),
    dataUpdatedAt: 0,
  },
}));

vi.mock('@/hooks/useCachedQuery', () => ({
  useCachedQuery: () => queryState.current,
}));

import {
  defaultSuperAdminDashboardData,
  useSuperAdminDashboardData,
} from './useSuperAdminDashboardData';

describe('useSuperAdminDashboardData refresh stability', () => {
  beforeEach(() => {
    queryState.current = {
      data: undefined,
      isLoading: true,
      isFetching: true,
      error: null,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    };
  });

  it('retains the last successful payload instead of returning to the loading skeleton', () => {
    const loaded = {
      ...defaultSuperAdminDashboardData,
      stats: { ...defaultSuperAdminDashboardData.stats, totalSchools: 7 },
    };
    queryState.current = {
      ...queryState.current,
      data: loaded,
      isLoading: false,
      isFetching: false,
      dataUpdatedAt: 100,
    };
    const { result, rerender } = renderHook(() => useSuperAdminDashboardData());
    expect(result.current.stats.totalSchools).toBe(7);
    expect(result.current.loading).toBe(false);

    queryState.current = {
      ...queryState.current,
      data: undefined,
      isLoading: true,
      isFetching: true,
      dataUpdatedAt: 100,
    };
    rerender();

    expect(result.current.stats.totalSchools).toBe(7);
    expect(result.current.loading).toBe(false);
    expect(result.current.fetching).toBe(true);
  });
});
