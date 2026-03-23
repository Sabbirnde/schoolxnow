import React from 'react';
import { AlertCircle, RefreshCcw, Home, Bug } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-2xl w-full">
            <div className="rounded-lg border bg-card text-card-foreground shadow-lg">
              <div className="flex flex-col space-y-6 p-6 md:p-8">
                {/* Icon and Title */}
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-destructive/10 p-3">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
                    <p className="text-muted-foreground mt-2">
                      We're sorry, but an unexpected error occurred. Our team has been notified.
                    </p>
                  </div>
                </div>

                {/* Error Details - Collapsible */}
                <details className="rounded-md border bg-muted/50 overflow-hidden">
                  <summary className="cursor-pointer px-4 py-3 font-medium text-sm hover:bg-muted/80 transition-colors flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Technical Details
                  </summary>
                  <div className="px-4 py-3 border-t">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Error Message:</p>
                        <p className="text-sm font-mono bg-background p-2 rounded border">
                          {this.state.error?.message || 'Unknown error'}
                        </p>
                      </div>
                      {this.state.error?.stack && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Stack Trace:</p>
                          <pre className="text-xs font-mono bg-background p-2 rounded border overflow-x-auto whitespace-pre-wrap break-words">
                            {this.state.error.stack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </details>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors touch-target"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reload Page
                  </button>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors touch-target"
                  >
                    <Home className="h-4 w-4" />
                    Go to Home
                  </button>
                </div>

                {/* Helpful Tips */}
                <div className="rounded-md border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 p-4">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    What you can do:
                  </p>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                    <li>Try reloading the page</li>
                    <li>Clear your browser cache and cookies</li>
                    <li>Check your internet connection</li>
                    <li>Contact support if the problem persists</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
