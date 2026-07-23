/**
 * Production Error Telemetry Service
 * Captures and reports error context for production debugging
 * 
 * Features:
 * - Error deduplication to prevent spam
 * - Automatic context collection (environment, user, session)
 * - Client-side queue with batch sending
 * - Circuit breaker pattern for resilience
 * - Privacy-aware (no sensitive data)
 */

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  userRole?: string;
  schoolId?: string;
  url?: string;
  timestamp?: string;
  userAgent?: string;
  environment?: string;
  errorCount?: number;
}

export interface ErrorTelemetry {
  id: string;
  message: string;
  stack?: string;
  errorType?: string;
  operation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: ErrorContext;
  breadcrumbs?: Array<{
    timestamp: string;
    message: string;
    level: 'info' | 'warning' | 'error';
  }>;
  tags?: Record<string, string>;
  isDuplicate?: boolean;
  originalErrorId?: string;
  timestamp: string;
}

class ErrorTelemetryService {
  private queue: ErrorTelemetry[] = [];
  private sentErrors = new Map<string, number>(); // For deduplication
  private circuitBreakerOpen = false;
  private failureCount = 0;
  private readonly maxFailures = 5;
  private readonly maxQueueSize = 50;
  private readonly sendInterval = 30000; // 30 seconds
  private readonly deduplicationWindow = 60000; // 1 minute
  private isProcessing = false;
  private lastFlushTime = 0;
  private breadcrumbs: ErrorTelemetry['breadcrumbs'] = [];
  private readonly maxBreadcrumbs = 20;
  private contextData: ErrorContext = {};

  constructor() {
    this.setupGlobalErrorHandlers();
    this.startPeriodicFlush();
    this.setupBeforeUnload();
  }

  /**
   * Set contextual information about current user/session
   */
  setContext(context: Partial<ErrorContext>): void {
    this.contextData = {
      ...this.contextData,
      ...context,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Add a breadcrumb for error tracking (keeps last N messages)
   */
  addBreadcrumb(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.breadcrumbs) {
      this.breadcrumbs = [];
    }

    this.breadcrumbs.push({
      timestamp: new Date().toISOString(),
      message,
      level,
    });

    // Keep only the last N breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  /**
   * Check if error is a duplicate of recently reported error
   */
  private isDuplicate(message: string, stack?: string): boolean {
    const fingerprint = `${message}${stack || ''}`;
    const hash = this.hashCode(fingerprint);
    const lastSentTime = this.sentErrors.get(hash);

    if (lastSentTime && Date.now() - lastSentTime < this.deduplicationWindow) {
      return true;
    }

    this.sentErrors.set(hash, Date.now());
    return false;
  }

  /**
   * Simple hash function for deduplication
   */
  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Capture an error with telemetry data
   */
  captureError(
    message: string,
    options: {
      error?: Error | string;
      errorType?: string;
      operation?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      context?: Record<string, unknown>;
      tags?: Record<string, string>;
    } = {}
  ): void {
    // Don't capture if circuit breaker is open
    if (this.circuitBreakerOpen) {
      console.warn('[ErrorTelemetry] Circuit breaker open, skipping error capture');
      return;
    }

    const {
      error,
      errorType = 'Error',
      operation,
      severity = 'medium',
      context = {},
      tags = {},
    } = options;

    const stack = error instanceof Error ? error.stack : undefined;
    const isDuplicate = this.isDuplicate(message, stack);

    const telemetry: ErrorTelemetry = {
      id: this.generateId(),
      message,
      stack,
      errorType,
      operation,
      severity,
      context: {
        ...this.contextData,
        ...context,
      },
      breadcrumbs: [...(this.breadcrumbs || [])],
      tags,
      isDuplicate,
      timestamp: new Date().toISOString(),
    };

    // If duplicate, link to original error
    if (isDuplicate) {
      const errorHash = this.hashCode(`${message}${stack || ''}`);
      telemetry.originalErrorId = errorHash;
    }

    this.addToQueue(telemetry);

    // Add breadcrumb for this error capture
    this.addBreadcrumb(`Error captured: ${message}`, 'error');

    // Log in development
    if (import.meta.env.DEV) {
      console.error('[ErrorTelemetry]', {
        message,
        errorType,
        operation,
        severity,
        isDuplicate,
      });
    }
  }

  /**
   * Add error to queue with size limits
   */
  private addToQueue(telemetry: ErrorTelemetry): void {
    this.queue.push(telemetry);

    // Maintain max queue size (drop oldest if over limit)
    if (this.queue.length > this.maxQueueSize) {
      this.queue = this.queue.slice(-this.maxQueueSize);
    }

    // Try to flush if queue is getting full
    if (this.queue.length >= 10) {
      this.flush();
    }
  }

  /**
   * Flush queued errors to backend
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0 || this.isProcessing) {
      return;
    }

    // Rate limiting: don't flush too frequently
    if (Date.now() - this.lastFlushTime < 5000) {
      return;
    }

    this.isProcessing = true;
    const errorsToSend = [...this.queue];
    this.queue = [];

    try {
      await this.sendErrorsTelemetry(errorsToSend);
      this.failureCount = 0; // Reset on success
      this.lastFlushTime = Date.now();
    } catch (error) {
      this.failureCount++;
      // Re-queue errors if sending failed
      this.queue.unshift(...errorsToSend);

      if (this.failureCount >= this.maxFailures) {
        this.circuitBreakerOpen = true;
        console.error('[ErrorTelemetry] Circuit breaker opened after multiple failures');
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send errors to backend endpoint
   */
  private async sendErrorsTelemetry(errors: ErrorTelemetry[]): Promise<void> {
    const endpoint =
      import.meta.env.VITE_ERROR_TELEMETRY_ENDPOINT ||
      (import.meta.env.PROD ? '/api/telemetry/errors' : '');

    // Skip if no endpoint configured
    if (!endpoint) {
      if (import.meta.env.DEV) {
        console.log('[ErrorTelemetry] No endpoint configured, errors logged locally only');
      }
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Telemetry-Version': '1.0',
        },
        body: JSON.stringify({
          errors,
          timestamp: new Date().toISOString(),
          environment: import.meta.env.PROD ? 'production' : 'development',
          appVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
        }),
        // Use keepalive for beacon-like behavior
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error(`Telemetry request failed: ${response.status}`);
      }
    } catch (error) {
      // Don't throw, just log locally
      if (import.meta.env.DEV) {
        console.error('[ErrorTelemetry] Failed to send errors:', error);
      }
      throw error;
    }
  }

  /**
   * Setup automatic periodic flushing
   */
  private startPeriodicFlush(): void {
    // Only set up periodic flushing in production or if telemetry is enabled
    if (typeof window !== 'undefined') {
      setInterval(() => {
        if (this.queue.length > 0) {
          this.flush();
        }
      }, this.sendInterval);
    }
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return;

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(`Unhandled Promise Rejection: ${event.reason}`, {
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        errorType: 'UnhandledRejection',
        severity: 'high',
      });
    });

    // Capture global errors
    window.addEventListener('error', (event) => {
      this.captureError(`Global Error: ${event.message}`, {
        error: event.error || new Error(event.message),
        errorType: 'GlobalError',
        severity: 'high',
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });
  }

  /**
   * Flush on page unload to ensure errors are sent
   */
  private setupBeforeUnload(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeunload', () => {
      // Use sendBeacon for guaranteed delivery on page unload
      if (this.queue.length > 0) {
        const endpoint =
          import.meta.env.VITE_ERROR_TELEMETRY_ENDPOINT ||
          (import.meta.env.PROD ? '/api/telemetry/errors' : '');
        if (endpoint && navigator.sendBeacon) {
          navigator.sendBeacon(
            endpoint,
            JSON.stringify({
              errors: this.queue,
              timestamp: new Date().toISOString(),
              environment: import.meta.env.PROD ? 'production' : 'development',
            })
          );
        }
      }
    });
  }

  /**
   * Get current queue for monitoring
   */
  getQueueStatus(): {
    queueSize: number;
    sentErrorCount: number;
    circuitBreakerOpen: boolean;
    failureCount: number;
  } {
    return {
      queueSize: this.queue.length,
      sentErrorCount: this.sentErrors.size,
      circuitBreakerOpen: this.circuitBreakerOpen,
      failureCount: this.failureCount,
    };
  }

  /**
   * Reset circuit breaker (for testing or recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.failureCount = 0;
    console.log('[ErrorTelemetry] Circuit breaker reset');
  }

  /**
   * Generate unique ID for error
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const errorTelemetry = new ErrorTelemetryService();
