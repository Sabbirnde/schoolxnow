import { useQuery, UseQueryOptions, QueryKey } from '@tanstack/react-query';
import { cacheConfig } from '@/lib/query-client';

/**
 * Custom hook for cached queries with predefined cache strategies
 * Usage: const { data } = useCachedQuery('static', ['key'], fetchFn);
 */
export function useCachedQuery<TData = unknown, TError = Error>(
  cacheType: 'dashboard' | 'static' | 'semiStatic' | 'dynamic' | 'realtime',
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TData, TError>({
    queryKey,
    queryFn,
    ...cacheConfig[cacheType],
    ...options,
  });
}
