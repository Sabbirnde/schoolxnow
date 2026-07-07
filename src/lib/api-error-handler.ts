// Supabase client error handling and logging utilities
import { SupabaseClient } from '@/integrations/php-api/compat-types';
import type { Database } from '@/integrations/database/types';
import SecureConfig from './secure-config';
import { errorTelemetry } from './error-telemetry';

type ErrorLike = {
  name?: string;
  message?: string;
  code?: string | number;
  details?: string;
  hint?: string;
  status?: string | number;
  stack?: string;
};

const toErrorLike = (error: unknown): ErrorLike => {
  if (error && typeof error === 'object') {
    return error as ErrorLike;
  }

  return { message: typeof error === 'string' ? error : undefined };
};

/**
 * Error types for better categorization
 */
export enum SupabaseErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  UNKNOWN = 'UNKNOWN',
}

export interface SupabaseErrorNotice {
  title: string;
  description: string;
  type: SupabaseErrorType;
  operation: string;
  code?: string;
}

interface SupabaseErrorHandlingOptions {
  context?: Record<string, unknown>;
  fallbackMessage?: string;
  title?: string;
  log?: boolean;
}

/**
 * Enhanced error class with additional context
 */
export class SupabaseOperationError extends Error {
  constructor(
    message: string,
    public type: SupabaseErrorType,
    public operation: string,
    public originalError?: unknown,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SupabaseOperationError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      operation: this.operation,
      originalError: this.originalError,
      context: this.context,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Categorizes Supabase errors by type
 */
export function categorizeError(error: unknown): SupabaseErrorType {
  if (!error) return SupabaseErrorType.UNKNOWN;

  const errorLike = toErrorLike(error);
  const message = errorLike.message?.toLowerCase() || '';
  const code = errorLike.code?.toString() || '';

  // Network errors
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection')
  ) {
    return SupabaseErrorType.NETWORK;
  }

  // Authentication errors
  if (
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('auth') ||
    message.includes('session') ||
    code === 'PGRST301' ||
    code === '401'
  ) {
    return SupabaseErrorType.AUTHENTICATION;
  }

  // Authorization errors
  if (
    message.includes('permission') ||
    message.includes('policy') ||
    message.includes('rls') ||
    code === '42501' ||
    code === '403'
  ) {
    return SupabaseErrorType.AUTHORIZATION;
  }

  // Not found / empty single-row responses
  if (
    message.includes('not found') ||
    message.includes('no rows') ||
    code === 'PGRST116' ||
    code === '404'
  ) {
    return SupabaseErrorType.NOT_FOUND;
  }

  // Database errors
  if (
    message.includes('violates') ||
    message.includes('constraint') ||
    message.includes('duplicate') ||
    code === '23505' ||
    code === '23503' ||
    code === '23502' ||
    code === '23514'
  ) {
    return SupabaseErrorType.DATABASE;
  }

  // Validation errors
  if (
    message.includes('invalid') ||
    message.includes('required') ||
    message.includes('validation')
  ) {
    return SupabaseErrorType.VALIDATION;
  }

  return SupabaseErrorType.UNKNOWN;
}

/**
 * Generates user-friendly error messages
 */
export function getFriendlyErrorMessage(error: unknown, operation: string): string {
  const errorType = categorizeError(error);
  const errorLike = toErrorLike(error);
  const message = errorLike.message || '';
  const code = errorLike.code?.toString() || '';
  const lowerMessage = message.toLowerCase();
  const lowerDetails = errorLike.details?.toLowerCase() || '';

  switch (errorType) {
    case SupabaseErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    
    case SupabaseErrorType.AUTHENTICATION:
      return 'Your session has expired or is invalid. Please log in again.';
    
    case SupabaseErrorType.AUTHORIZATION:
      return 'You do not have permission to perform this action. Please contact your administrator.';

    case SupabaseErrorType.NOT_FOUND:
      return 'The requested record could not be found. It may have been removed or you may need to refresh the page.';
    
    case SupabaseErrorType.DATABASE:
      if (code === '23505' || lowerMessage.includes('duplicate') || lowerDetails.includes('already exists')) {
        return 'This record already exists. Please use a different value.';
      }
      if (code === '23503' || lowerMessage.includes('foreign key')) {
        return 'Cannot complete this action due to related records. Please check dependencies.';
      }
      if (code === '23502' || lowerMessage.includes('null value')) {
        return 'Some required information is missing. Please review the form and try again.';
      }
      if (code === '23514' || lowerMessage.includes('check constraint')) {
        return 'One or more values are outside the allowed range. Please review your input.';
      }
      return 'A database error occurred. Please try again or contact support.';
    
    case SupabaseErrorType.VALIDATION:
      return errorLike.message || 'The data provided is invalid. Please check your input and try again.';
    
    default:
      return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
  }
}

function getErrorTitle(errorType: SupabaseErrorType, operation: string): string {
  switch (errorType) {
    case SupabaseErrorType.NETWORK:
      return 'Connection problem';
    case SupabaseErrorType.AUTHENTICATION:
      return 'Session expired';
    case SupabaseErrorType.AUTHORIZATION:
      return 'Permission denied';
    case SupabaseErrorType.NOT_FOUND:
      return 'Record not found';
    case SupabaseErrorType.DATABASE:
      return 'Could not save changes';
    case SupabaseErrorType.VALIDATION:
      return 'Please check your input';
    default:
      return `${operation} failed`;
  }
}

/**
 * Shared UI-facing handler for Supabase failures.
 *
 * Returns a sanitized, user-friendly notice while logging structured developer
 * details through the common Supabase logger/telemetry path.
 */
export function handleSupabaseError(
  operation: string,
  error: unknown,
  options: SupabaseErrorHandlingOptions = {}
): SupabaseErrorNotice {
  const errorType = categorizeError(error);
  const errorLike = toErrorLike(error);

  if (options.log !== false) {
    logSupabaseError(operation, error, options.context);
  }

  return {
    title: options.title || getErrorTitle(errorType, operation),
    description: options.fallbackMessage || getFriendlyErrorMessage(error, operation),
    type: errorType,
    operation,
    code: errorLike.code?.toString(),
  };
}

export function getSupabaseErrorMessage(
  operation: string,
  error: unknown,
  fallbackMessage?: string
): string {
  return handleSupabaseError(operation, error, {
    fallbackMessage,
    log: false,
  }).description;
}

/**
 * Logs errors with appropriate detail level based on environment
 * @security All errors are sanitized to remove credentials before logging
 */
export function logSupabaseError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorType = categorizeError(error);
  const isDev = import.meta.env.DEV;

  // Sanitize error to remove any credentials
  const sanitizedError = toErrorLike(SecureConfig.sanitizeError(error));
  const sanitizedContext = context ? SecureConfig.sanitizeError(context) : undefined;

  // Always log basic error info (sanitized)
  console.error(`[Supabase ${errorType}] ${operation} failed:`, {
    message: sanitizedError.message || 'No message',
    code: sanitizedError.code,
    type: errorType,
  });

  // In development, log full details (but still sanitized)
  if (isDev) {
    console.group(`🔍 Error Details (${operation}) - Credentials Masked`);
    console.error('Sanitized Error:', sanitizedError);
    if (sanitizedContext) {
      console.log('Sanitized Context:', sanitizedContext);
    }
    if (sanitizedError.stack) {
      console.log('Stack:', sanitizedError.stack);
    }
    console.groupEnd();
  }

  // Send to error telemetry in production
  if (!isDev) {
    // Determine severity based on error type
    const severity = getSeverityForErrorType(errorType);

    // Capture in telemetry service (sanitized)
    errorTelemetry.captureError(sanitizedError.message || 'Supabase operation failed', {
      error: sanitizedError,
      errorType: errorType.toString(),
      operation,
      severity,
      context: {
        ...sanitizedContext,
        errorCode: sanitizedError.code,
      },
      tags: {
        service: 'supabase',
        operation: operation,
        errorType: errorType.toString(),
      },
    });
  }
}

/**
 * Determines severity level for error type
 */
function getSeverityForErrorType(errorType: SupabaseErrorType): 'low' | 'medium' | 'high' | 'critical' {
  switch (errorType) {
    case SupabaseErrorType.AUTHENTICATION:
    case SupabaseErrorType.AUTHORIZATION:
      return 'high';
    case SupabaseErrorType.NOT_FOUND:
      return 'low';
    case SupabaseErrorType.NETWORK:
      return 'medium';
    case SupabaseErrorType.DATABASE:
      return 'high';
    case SupabaseErrorType.VALIDATION:
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * Logs successful operations (in development only)
 */
export function logSupabaseSuccess(
  operation: string,
  result?: unknown,
  duration?: number
): void {
  if (!import.meta.env.DEV) return;

  console.log(`✅ [Supabase] ${operation} succeeded`, {
    duration: duration ? `${duration}ms` : undefined,
    resultType: result ? typeof result : undefined,
    resultCount: Array.isArray(result) ? result.length : undefined,
  });
}

/**
 * Wrapper for Supabase operations with automatic error handling and logging
 */
export async function withSupabaseErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<{ data: T | null; error: SupabaseOperationError | null }> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - startTime);
    
    logSupabaseSuccess(operation, result, duration);
    
    return { data: result, error: null };
  } catch (error: unknown) {
    const duration = Math.round(performance.now() - startTime);
    const errorType = categorizeError(error);
    
    logSupabaseError(operation, error, { ...context, duration });
    
    const operationError = new SupabaseOperationError(
      getFriendlyErrorMessage(error, operation),
      errorType,
      operation,
      error,
      context
    );
    
    return { data: null, error: operationError };
  }
}

/**
 * Monitors Supabase client health
 */
export class SupabaseHealthMonitor {
  private client: SupabaseClient<Database>;
  private isHealthy: boolean = true;
  private lastCheck: Date | null = null;
  private errorCount: number = 0;
  private consecutiveErrors: number = 0;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  /**
   * Performs a health check
   */
  async checkHealth(): Promise<{ healthy: boolean; message: string; details?: unknown }> {
    const startTime = performance.now();
    
    try {
      // Test database connectivity
      const { error: dbError } = await this.client
        .from('schools')
        .select('id', { count: 'exact', head: true })
        .limit(1);

      if (dbError) {
        throw dbError;
      }

      // Test auth service
      const { error: authError } = await this.client.auth.getSession();
      
      if (authError) {
        throw authError;
      }

      const duration = Math.round(performance.now() - startTime);
      this.isHealthy = true;
      this.lastCheck = new Date();
      this.consecutiveErrors = 0;

      if (import.meta.env.DEV) {
        console.log('✅ [Health Check] Supabase is healthy', {
          duration: `${duration}ms`,
          timestamp: this.lastCheck.toISOString(),
        });
      }

      return {
        healthy: true,
        message: 'All services operational',
        details: { duration, lastCheck: this.lastCheck },
      };
    } catch (error: unknown) {
      const duration = Math.round(performance.now() - startTime);
      this.isHealthy = false;
      this.lastCheck = new Date();
      this.errorCount++;
      this.consecutiveErrors++;

      const errorType = categorizeError(error);
      const errorLike = toErrorLike(error);
      
      console.error('❌ [Health Check] Supabase health check failed', {
        errorType,
        message: errorLike.message,
        duration: `${duration}ms`,
        consecutiveErrors: this.consecutiveErrors,
      });

      return {
        healthy: false,
        message: getFriendlyErrorMessage(error, 'Health Check'),
        details: {
          errorType,
          consecutiveErrors: this.consecutiveErrors,
          totalErrors: this.errorCount,
          lastCheck: this.lastCheck,
        },
      };
    }
  }

  /**
   * Gets current health status
   */
  getStatus() {
    return {
      healthy: this.isHealthy,
      lastCheck: this.lastCheck,
      errorCount: this.errorCount,
      consecutiveErrors: this.consecutiveErrors,
    };
  }

  /**
   * Resets error counters
   */
  reset() {
    this.errorCount = 0;
    this.consecutiveErrors = 0;
  }
}

/**
 * Connection retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoff?: boolean;
    onRetry?: (attempt: number, error: unknown) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoff = true,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      
      const errorType = categorizeError(error);
      const errorLike = toErrorLike(error);
      
      // Don't retry authentication or authorization errors
      if (
        errorType === SupabaseErrorType.AUTHENTICATION ||
        errorType === SupabaseErrorType.AUTHORIZATION
      ) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
      
      if (import.meta.env.DEV) {
        console.warn(`⚠️  Retry attempt ${attempt}/${maxRetries} after ${delay}ms`, {
          error: errorLike.message,
          errorType,
        });
      }

      if (onRetry) {
        onRetry(attempt, error);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
