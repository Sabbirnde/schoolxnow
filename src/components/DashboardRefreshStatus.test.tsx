import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardRefreshStatus } from './DashboardRefreshStatus';

describe('DashboardRefreshStatus', () => {
  it('keeps a stable visible label while a background refresh runs', () => {
    const onRefresh = vi.fn();
    const { rerender } = render(
      <DashboardRefreshStatus updatedAt={Date.now()} fetching={false} onRefresh={onRefresh} />,
    );

    const button = screen.getByRole('button', { name: 'Refresh dashboard data' });
    expect(button).toHaveTextContent('Refresh');
    expect(button).not.toHaveTextContent(/^Refreshing$/);
    expect(button).toHaveAttribute('aria-busy', 'false');

    rerender(
      <DashboardRefreshStatus updatedAt={Date.now()} fetching onRefresh={onRefresh} />,
    );

    expect(screen.getByRole('button', { name: 'Refresh dashboard data' })).toHaveTextContent('Refresh');
    expect(screen.getByRole('button', { name: 'Refresh dashboard data' })).toHaveAttribute('aria-busy', 'true');
  });
});
