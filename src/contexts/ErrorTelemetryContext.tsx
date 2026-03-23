import React, { createContext, useContext, useEffect } from 'react';
import { errorTelemetry } from '@/lib/error-telemetry';
import type { ErrorContext } from '@/lib/error-telemetry';

interface ErrorTelemetryContextType {
  setErrorContext: (context: Partial<ErrorContext>) => void;
  captureError: typeof errorTelemetry.captureError;
  addBreadcrumb: typeof errorTelemetry.addBreadcrumb;
  getStatus: typeof errorTelemetry.getQueueStatus;
}

const ErrorTelemetryContext = createContext<ErrorTelemetryContextType | undefined>(undefined);

/**
 * Provider component for error telemetry
 * Should wrap the root of the application
 */
export function ErrorTelemetryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize telemetry with environment info
    const context: Partial<ErrorContext> = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      environment: import.meta.env.PROD ? 'production' : 'development',
    };

    errorTelemetry.setContext(context);

    // Set up page visibility tracking for breadcrumbs
    const handleVisibilityChange = () => {
      if (document.hidden) {
        errorTelemetry.addBreadcrumb('Page hidden', 'info');
      } else {
        errorTelemetry.addBreadcrumb('Page visible', 'info');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track navigation changes
    const handlePopState = (event: PopStateEvent) => {
      errorTelemetry.addBreadcrumb(`Navigation: ${window.location.href}`, 'info');
    };

    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const contextValue: ErrorTelemetryContextType = {
    setErrorContext: (context) => errorTelemetry.setContext(context),
    captureError: (message, options) => errorTelemetry.captureError(message, options),
    addBreadcrumb: (message, level) => errorTelemetry.addBreadcrumb(message, level),
    getStatus: () => errorTelemetry.getQueueStatus(),
  };

  return (
    <ErrorTelemetryContext.Provider value={contextValue}>
      {children}
    </ErrorTelemetryContext.Provider>
  );
}

/**
 * Hook to access error telemetry in components
 */
export function useErrorTelemetry(): ErrorTelemetryContextType {
  const context = useContext(ErrorTelemetryContext);

  if (!context) {
    console.warn(
      'useErrorTelemetry called outside of ErrorTelemetryProvider. ' +
      'Make sure ErrorTelemetryProvider wraps your component tree.'
    );

    // Return a no-op context if provider is missing
    return {
      setErrorContext: () => {},
      captureError: () => {},
      addBreadcrumb: () => {},
      getStatus: () => ({
        queueSize: 0,
        sentErrorCount: 0,
        circuitBreakerOpen: false,
        failureCount: 0,
      }),
    };
  }

  return context;
}
