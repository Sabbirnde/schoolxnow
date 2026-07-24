import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardRefreshStatusProps {
  updatedAt: number;
  fetching?: boolean;
  onRefresh?: () => void | Promise<unknown>;
}

export function DashboardRefreshStatus({
  updatedAt,
  fetching = false,
  onRefresh,
}: DashboardRefreshStatusProps) {
  const timestamp = updatedAt
    ? new Date(updatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Waiting for first refresh';

  return (
    <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Last updated: {timestamp}</span>
      {onRefresh && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-[5.75rem] gap-1.5 px-2"
          disabled={fetching}
          onClick={() => void onRefresh()}
          aria-label="Refresh dashboard data"
          aria-busy={fetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
          <span className="sr-only" aria-live="polite">
            {fetching ? 'Dashboard refresh in progress' : 'Dashboard data is current'}
          </span>
        </Button>
      )}
    </div>
  );
}
