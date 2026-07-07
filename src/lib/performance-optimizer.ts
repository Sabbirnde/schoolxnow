// Performance optimization utilities for Supabase operations
import { isPhpBackend } from '@/integrations/backend/provider';
import { phpApi } from '@/integrations/php-api/client';
import type { Database } from '@/integrations/database/types';

type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type CacheEntry = { data: unknown; timestamp: number; ttl: number };
type SupabaseQueryResult<T> = { data: T[] | null; error: unknown; count?: number | null };
type SupabaseQueryBuilder<T> = {
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder<T>;
  then: Promise<SupabaseQueryResult<T>>['then'];
};
type BatchOperation = {
  id: string;
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};
type BulkOperationError = { chunk?: number; record?: unknown; error: unknown };

/**
 * Query cache for reducing redundant database calls
 */
class QueryCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultTTL = 60000; // 1 minute default

  /**
   * Get cached data if available and not expired
   */
  get<T = unknown>(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    if (import.meta.env.DEV) {
      console.log(`✨ [Cache HIT] ${key}`);
    }
    
    return cached.data as T;
  }

  /**
   * Set cache data
   */
  set(key: string, data: unknown, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    
    if (import.meta.env.DEV) {
      console.log(`💾 [Cache SET] ${key} (TTL: ${ttl}ms)`);
    }
  }

  /**
   * Clear specific cache entry
   */
  clear(key: string): void {
    this.cache.delete(key);
    if (import.meta.env.DEV) {
      console.log(`🗑️  [Cache CLEAR] ${key}`);
    }
  }

  /**
   * Clear all cache
   */
  clearAll(): void {
    this.cache.clear();
    if (import.meta.env.DEV) {
      console.log('🗑️  [Cache] Cleared all entries');
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

export const queryCache = new QueryCache();

/**
 * Cached query wrapper
 */
export async function cachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttl: number = 60000
): Promise<T> {
  // Check cache first
  const cached = queryCache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Execute query
  const result = await queryFn();
  
  // Cache the result
  queryCache.set(cacheKey, result, ttl);
  
  return result;
}

/**
 * Batch query utility to combine multiple queries
 */
export async function batchQueries<T extends Record<string, () => Promise<unknown>>>(
  queries: T
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const startTime = performance.now();
  
  const entries = Object.entries(queries);
  const results = await Promise.allSettled(
    entries.map(([_, queryFn]) => queryFn())
  );

  const duration = Math.round(performance.now() - startTime);
  
  if (import.meta.env.DEV) {
    console.log(`⚡ [Batch Query] Completed ${entries.length} queries in ${duration}ms`);
  }

  const output: Partial<{ [K in keyof T]: Awaited<ReturnType<T[K]>> | null }> = {};
  entries.forEach(([key], index) => {
    const result = results[index];
    if (result.status === 'fulfilled') {
      output[key as keyof T] = result.value as Awaited<ReturnType<T[keyof T]>>;
    } else {
      console.error(`❌ [Batch Query] ${key} failed:`, result.reason);
      output[key as keyof T] = null;
    }
  });

  return output as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}

/**
 * Optimized pagination helper
 */
export async function paginatedQuery<T extends TableName>(
  table: T,
  options: {
    page: number;
    pageSize: number;
    orderBy?: string;
    orderAscending?: boolean;
    filter?: (query: SupabaseQueryBuilder<Tables[T]['Row']>) => SupabaseQueryBuilder<Tables[T]['Row']>;
  }
): Promise<{
  data: Tables[T]['Row'][];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const { page, pageSize, orderBy, orderAscending = true, filter } = options;
  
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (isPhpBackend) {
    if (filter) {
      throw new Error('paginatedQuery filter callbacks are only supported with the Supabase backend.');
    }

    const params: Record<string, string | number> = {
      limit: pageSize,
      offset: from,
    };

    if (orderBy) {
      params.sort = orderBy;
      params.order = orderAscending ? 'asc' : 'desc';
    }

    const [data, count] = await Promise.all([
      phpApi.table<Record<string, unknown>>(String(table)).list(params),
      phpApi.table<Record<string, unknown>>(String(table)).count(),
    ]);
    const totalPages = count.count ? Math.ceil(count.count / pageSize) : 0;

    return {
      data: data as Tables[T]['Row'][],
      count: count.count,
      page,
      pageSize,
      totalPages,
    };
  }

  const { supabase } = await import('@/integrations/php-api/compat-client');
  let query = supabase
    .from(table as never)
    .select('*', { count: 'exact' })
    .range(from, to) as unknown as SupabaseQueryBuilder<Tables[T]['Row']>;

  if (orderBy) {
    query = query.order(orderBy, { ascending: orderAscending });
  }

  if (filter) {
    query = filter(query);
  }

  const { data, error, count } = await query;

  if (error) throw error;

  const totalPages = count ? Math.ceil(count / pageSize) : 0;

  return {
    data: data || [],
    count: count || 0,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Optimized search with debouncing
 */
export class SearchOptimizer {
  private timeoutId: NodeJS.Timeout | null = null;
  private lastSearch: string = '';
  private debounceMs: number;

  constructor(debounceMs: number = 300) {
    this.debounceMs = debounceMs;
  }

  /**
   * Debounced search
   */
  async search<T>(
    searchTerm: string,
    searchFn: (term: string) => Promise<T>
  ): Promise<T | null> {
    return new Promise((resolve) => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }

      // Return cached result if same search
      if (searchTerm === this.lastSearch) {
        const cached = queryCache.get(`search:${searchTerm}`);
        if (cached) {
          resolve(cached);
          return;
        }
      }

      this.timeoutId = setTimeout(async () => {
        try {
          const result = await searchFn(searchTerm);
          this.lastSearch = searchTerm;
          queryCache.set(`search:${searchTerm}`, result, 30000); // Cache for 30s
          resolve(result);
        } catch (error) {
          console.error('Search error:', error);
          resolve(null);
        }
      }, this.debounceMs);
    });
  }

  /**
   * Cancel pending search
   */
  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Connection pooling for multiple operations
 */
export class OperationBatcher {
  private operations: BatchOperation[] = [];
  private processingTimeout: NodeJS.Timeout | null = null;
  private maxBatchSize = 10;
  private batchDelayMs = 50;

  /**
   * Add operation to batch
   */
  async add<T>(id: string, operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.operations.push({ id, fn: operation, resolve, reject });

      // Process if batch is full
      if (this.operations.length >= this.maxBatchSize) {
        this.processBatch();
      } else {
        // Schedule batch processing
        if (this.processingTimeout) {
          clearTimeout(this.processingTimeout);
        }
        this.processingTimeout = setTimeout(() => this.processBatch(), this.batchDelayMs);
      }
    });
  }

  /**
   * Process batched operations
   */
  private async processBatch(): Promise<void> {
    if (this.operations.length === 0) return;

    const batch = [...this.operations];
    this.operations = [];

    if (import.meta.env.DEV) {
      console.log(`⚡ [Batch] Processing ${batch.length} operations`);
    }

    const results = await Promise.allSettled(
      batch.map(op => op.fn())
    );

    batch.forEach((op, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        op.resolve(result.value);
      } else {
        op.reject(result.reason);
      }
    });
  }
}

/**
 * Request deduplication
 */
class RequestDeduplicator {
  private pending: Map<string, Promise<unknown>> = new Map();

  /**
   * Execute request with deduplication
   */
  async execute<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check if request is already pending
    if (this.pending.has(key)) {
      if (import.meta.env.DEV) {
        console.log(`🔄 [Dedup] Reusing pending request: ${key}`);
      }
      return this.pending.get(key)! as Promise<T>;
    }

    // Execute new request
    const promise = requestFn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Clear pending requests
   */
  clear(): void {
    this.pending.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();

/**
 * Optimized bulk insert
 */
export async function bulkInsert<T extends TableName>(
  table: T,
  records: Tables[T]['Insert'][],
  chunkSize: number = 1000
): Promise<{ success: number; failed: number; errors: BulkOperationError[] }> {
  const chunks: Tables[T]['Insert'][][] = [];
  for (let i = 0; i < records.length; i += chunkSize) {
    chunks.push(records.slice(i, i + chunkSize));
  }

  let success = 0;
  let failed = 0;
  const errors: BulkOperationError[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    if (import.meta.env.DEV) {
      console.log(`📥 [Bulk Insert] Processing chunk ${i + 1}/${chunks.length} (${chunk.length} records)`);
    }

    try {
      const { error } = await supabase
        .from(table)
        .insert(chunk);

      if (error) throw error;
      success += chunk.length;
    } catch (error) {
      console.error(`❌ [Bulk Insert] Chunk ${i + 1} failed:`, error);
      failed += chunk.length;
      errors.push({ chunk: i + 1, error });
    }
  }

  return { success, failed, errors };
}

/**
 * Optimized bulk update
 */
export async function bulkUpdate<T extends TableName>(
  table: T,
  updates: Array<{ id: string; data: Partial<Tables[T]['Update']> }>,
  chunkSize: number = 100
): Promise<{ success: number; failed: number; errors: BulkOperationError[] }> {
  const chunks: typeof updates[] = [];
  for (let i = 0; i < updates.length; i += chunkSize) {
    chunks.push(updates.slice(i, i + chunkSize));
  }

  let success = 0;
  let failed = 0;
  const errors: BulkOperationError[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    const results = await Promise.allSettled(
      chunk.map(({ id, data }) =>
        supabase
          .from(table)
          .update(data)
          .eq('id', id)
      )
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && !result.value.error) {
        success++;
      } else {
        failed++;
        errors.push({
          record: chunk[index],
          error: result.status === 'rejected' ? result.reason : result.value.error,
        });
      }
    });
  }

  return { success, failed, errors };
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private metrics: Map<string, { count: number; totalTime: number; avgTime: number }> = new Map();

  /**
   * Track operation performance
   */
  async track<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - startTime);
      this.recordMetric(operation, duration);
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.recordMetric(operation, duration);
      throw error;
    }
  }

  /**
   * Record metric
   */
  private recordMetric(operation: string, duration: number): void {
    const existing = this.metrics.get(operation) || { count: 0, totalTime: 0, avgTime: 0 };
    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    this.metrics.set(operation, existing);

    if (import.meta.env.DEV && duration > 1000) {
      console.warn(`⏱️  [Performance] Slow operation: ${operation} took ${duration}ms`);
    }
  }

  /**
   * Get performance report
   */
  getReport(): Record<string, { count: number; totalTime: number; avgTime: number }> {
    const report: Record<string, { count: number; totalTime: number; avgTime: number }> = {};
    this.metrics.forEach((value, key) => {
      report[key] = value;
    });
    return report;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();
