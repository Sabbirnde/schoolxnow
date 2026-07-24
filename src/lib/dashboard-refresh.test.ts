import { describe, expect, it, vi } from 'vitest';
import { pollOnlyWhenVisible } from '@/lib/dashboard-refresh';

describe('pollOnlyWhenVisible', () => {
  it('returns the interval for a visible tab and disables polling for a hidden tab', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    const interval = pollOnlyWhenVisible(60_000);

    visibility.mockReturnValue('visible');
    expect(interval()).toBe(60_000);

    visibility.mockReturnValue('hidden');
    expect(interval()).toBe(false);

    visibility.mockRestore();
  });
});
