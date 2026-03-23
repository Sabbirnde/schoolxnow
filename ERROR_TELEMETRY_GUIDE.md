# Production Error Telemetry Context

## Overview
Implemented a comprehensive error telemetry system for production debugging and monitoring. Captures error context, breadcrumbs, and user information to help diagnose issues in production environments.

---

## Architecture

### Components

#### 1. **Error Telemetry Service** (`src/lib/error-telemetry.ts`)
Core telemetry engine with:
- **Error Capture**: Captures errors with full context
- **Deduplication**: Prevents error spam (1-minute window)
- **Breadcrumbs**: Tracks user actions leading up to error
- **Circuit Breaker**: Resilient design (stops sending after 5 failures)
- **Queue Management**: Client-side buffering with automatic flushing
- **Global Handlers**: Catches unhandled exceptions and promise rejections

**Key Features:**
```typescript
// Capture an error
errorTelemetry.captureError('Operation failed', {
  error: new Error('Details'),
  errorType: 'ValidationError',
  operation: 'updateProfile',
  severity: 'high',
  tags: { userId: '123', schoolId: 'abc' }
});

// Add breadcrumb for tracking user actions
errorTelemetry.addBreadcrumb('User clicked save button', 'info');

// Set context
errorTelemetry.setContext({ userId: '123', schoolId: 'abc' });
```

#### 2. **Error Telemetry Context** (`src/contexts/ErrorTelemetryContext.tsx`)
React context provider that:
- Initializes telemetry with page info
- Tracks page visibility changes
- Monitors navigation
- Exposes telemetry to components via hook

**Usage:**
```typescript
const { captureError, addBreadcrumb, setErrorContext } = useErrorTelemetry();

captureError('Database update failed', {
  error: dbError,
  operation: 'saveUser',
  severity: 'high'
});
```

#### 3. **Error Telemetry Initializer** (`src/components/ErrorTelemetryInitializer.tsx`)
Component that:
- Observes authentication state
- Updates telemetry with user context when logged in
- Tracks login/logout events

---

## Integration Points

### 1. **App Initialization** (`src/main.tsx`)
```typescript
<ErrorTelemetryProvider>
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </QueryClientProvider>
</ErrorTelemetryProvider>
```

### 2. **Error Handler Integration** (`src/lib/supabase-error-handler.ts`)
All Supabase errors automatically captured:
```typescript
logSupabaseError(operation, error, context);
// Automatically:
// - Categorizes error type
// - Determines severity
// - Sends to telemetry service (if endpoint configured)
```

### 3. **Global Error Handlers**
Automatically captures:
- Unhandled exceptions (`window.error`)
- Unhandled promise rejections (`unhandledrejection`)
- Page unload (flushes queue)

---

## Error Context Captured

### Automatic Context
- `url`: Current page URL
- `userAgent`: Browser info
- `environment`: production/development
- `timestamp`: Error timestamp

### User Context (when logged in)
- `userId`: Current user ID
- `userRole`: User's role (teacher, school_admin, etc.)
- `schoolId`: School assignment
- `sessionId`: Session identifier

### Error Information
- `message`: Error message
- `stack`: Stack trace
- `errorType`: Error category (NETWORK, AUTH, DATABASE, etc.)
- `operation`: What operation failed
- `severity`: Impact level (low, medium, high, critical)
- `tags`: Custom tags for grouping

### Breadcrumbs (Last 20 events)
- User interactions
- Navigation events
- Page visibility changes
- Key operations

---

## Backend Integration

### Endpoint Configuration
Set `VITE_ERROR_TELEMETRY_ENDPOINT` in `.env`:
```
VITE_ERROR_TELEMETRY_ENDPOINT=https://your-api.com/api/errors
```

### Request Format
```json
{
  "errors": [
    {
      "id": "timestamp-random",
      "message": "Error message",
      "stack": "...",
      "errorType": "NETWORK",
      "operation": "fetchStudents",
      "severity": "high",
      "context": {
        "userId": "user-123",
        "userRole": "teacher",
        "schoolId": "school-456",
        "url": "https://app.com/dashboard"
      },
      "breadcrumbs": [
        {
          "timestamp": "2024-03-24T12:00:00Z",
          "message": "Page visible",
          "level": "info"
        }
      ],
      "tags": {
        "service": "supabase",
        "operation": "fetchStudents",
        "errorType": "NETWORK"
      },
      "isDuplicate": false,
      "timestamp": "2024-03-24T12:00:00Z"
    }
  ],
  "timestamp": "2024-03-24T12:00:00Z",
  "environment": "production",
  "appVersion": "0.0.1"
}
```

### Response Handling
- **200 OK**: Error accepted
- **4xx/5xx**: Logged but not retried (backoff)
- **Network Error**: Error remains in queue, retried on next flush

---

## Features

### Error Deduplication
Prevents duplicate errors within 1-minute window using:
- Error message + stack trace fingerprint
- Hash function for comparison
- Automatic cleanup of old entries

### Circuit Breaker Pattern
Stops sending after 5 consecutive failures to prevent:
- Network flooding
- Server overload
- Wasted bandwidth

Can be manually reset via:
```typescript
errorTelemetry.resetCircuitBreaker();
```

### Queue Management
- **Max queue size**: 50 errors
- **Auto-flush trigger**: 10+ errors in queue
- **Periodic flush**: Every 30 seconds
- **Page unload**: Uses `sendBeacon` for guaranteed delivery

### Breadcrumbs
Maintains last 20 events:
- User interactions
- Navigation
- Page visibility
- Custom application events

Example breadcrumbs:
```
- Application loaded
- User logged in: John Doe (teacher)
- Navigated to: /dashboard
- Page visible
- Error captured: Network timeout
```

---

## Configuration

### Environment Variables
```
# Required: Telemetry endpoint
VITE_ERROR_TELEMETRY_ENDPOINT=https://api.com/errors

# Optional: App version for tracking
VITE_APP_VERSION=1.0.0
```

### Severity Levels
Automatically determined by error type:
- **CRITICAL** (none yet, reserved for future)
- **HIGH**: Authentication, Authorization, Database
- **MEDIUM**: Network, Unknown
- **LOW**: Validation

### Development vs Production
- **Development**: Full logging to console, local queue only
- **Production**: Telemetry sent to endpoint (if configured)

---

## Usage Examples

### Basic Error Capture
```typescript
import { useErrorTelemetry } from '@/contexts/ErrorTelemetryContext';

export function MyComponent() {
  const { captureError, addBreadcrumb } = useErrorTelemetry();

  const handleSave = async () => {
    try {
      addBreadcrumb('Save button clicked', 'info');
      const response = await api.save(data);
      addBreadcrumb('Save successful', 'info');
    } catch (error) {
      captureError('Save failed', {
        error,
        operation: 'saveUser',
        severity: 'high',
        context: { dataSize: data.length }
      });
    }
  };

  return <button onClick={handleSave}>Save</button>;
}
```

### Component Error Boundary
```typescript
import ErrorBoundary from '@/components/ErrorBoundary';

export function ParentComponent() {
  return (
    <ErrorBoundary>
      <ChildComponent />
    </ErrorBoundary>
  );
}
```

### Conditional Telemetry
```typescript
// Only send critical errors in production
if (import.meta.env.PROD && severity === 'critical') {
  errorTelemetry.captureError(message, { error, severity });
}
```

---

## Debugging

### Check Queue Status
```typescript
const { captureError } = useErrorTelemetry();
const status = captureError.getQueueStatus?.();
// Returns: {
//   queueSize: 5,
//   sentErrorCount: 23,
//   circuitBreakerOpen: false,
//   failureCount: 0
// }
```

### Enable Debug Logging
Development mode automatically logs:
```
[ErrorTelemetry] Error captured: Network timeout
[ErrorTelemetry] Failed to send errors: 404 Not Found
[ErrorTelemetry] Circuit breaker opened after multiple failures
```

### Inspect Error Queue
```javascript
// In browser console (dev only)
window.errorTelemetry?.getQueueStatus();
```

---

## Security & Privacy

### Data Protection
- ✅ No passwords or tokens logged
- ✅ No full URLs with query parameters (for PII)
- ✅ Error messages sanitized via `SecureConfig`
- ✅ User context limited to ID/role (no names/emails)

### Sanitization
Built-in via `SecureConfig.sanitizeError()`:
- Removes credentials
- Masks API keys
- Removes sensitive URLs
- Filters authentication tokens

---

## Best Practices

### 1. Use Appropriate Severity
```typescript
// Correct severity levels
captureError('User not found', { severity: 'low' }); // Validation
captureError('Database unreachable', { severity: 'high' }); // Operations
captureError('Invalid token', { severity: 'high' }); // Security
```

### 2. Add Context
```typescript
captureError('Payment failed', {
  error,
  severity: 'high',
  context: {
    amount: '100.00',
    paymentMethod: 'card',
    userId: user.id
  }
});
```

### 3. Use Tags for Grouping
```typescript
captureError('Query timeout', {
  error,
  tags: {
    service: 'database',
    table: 'students',
    operation: 'search'
  }
});
```

### 4. Add Breadcrumbs
```typescript
// In event handlers
addBreadcrumb('Form submitted', 'info');

// In error paths
addBreadcrumb('Validation failed', 'warning');

// In recovery
addBreadcrumb('Retry attempt 1', 'info');
```

---

## Production Deployment

### Prerequisites
1. Backend endpoint for receiving errors
2. Database to store error telemetry
3. Dashboard for monitoring errors

### Setup Steps
1. Create backend endpoint to accept POST requests
2. Configure `VITE_ERROR_TELEMETRY_ENDPOINT` in environment
3. Deploy application
4. Test error capture in staging
5. Monitor error telemetry in dashboard

### Example Backend Endpoint (Node.js)
```typescript
app.post('/api/errors', async (req, res) => {
  const { errors, environment, appVersion } = req.body;

  // Store errors
  await ErrorLog.insertMany(errors.map(err => ({
    ...err,
    environment,
    appVersion,
    receivedAt: new Date()
  })));

  res.json({ success: true, count: errors.length });
});
```

---

## Monitoring & Alerting

### Key Metrics to Track
1. **Error Rate**: Errors per hour
2. **Error Types**: Distribution by type
3. **Affected Users**: Unique users with errors
4. **Recovery**: Errors that resolve by retry
5. **Critical Errors**: High severity errors

### Recommended Alerts
- Error rate > 10/hour
- Critical severity errors
- Circuit breaker activated
- Database connectivity errors > 3x in 5 minutes

---

## Troubleshooting

### Errors not being sent
1. Check `VITE_ERROR_TELEMETRY_ENDPOINT` is configured
2. Verify endpoint is accessible (no CORS issues)
3. Check circuit breaker status
4. Verify production build (not development)

### Too many duplicate errors
- Adjust deduplication window (default: 1 minute)
- Increase `maxQueueSize` if queue fills up

### Telemetry data is incomplete
- Ensure `ErrorTelemetryProvider` wraps entire app
- Verify auth context is available before errors occur
- Check that browser supports `sendBeacon`

---

## Version 1.0 Features

- ✅ Error capture with context
- ✅ Breadcrumb tracking
- ✅ Error deduplication
- ✅ Circuit breaker resilience
- ✅ Queue management
- ✅ Global error handlers
- ✅ User context tracking
- ✅ Severity categorization
- ✅ Custom tags support
- ✅ Batch sending (up to 50 errors)

## Future Enhancements (v2.0)
- [ ] Source map integration for stack trace mapping
- [ ] Error grouping by fingerprint
- [ ] Source package tracking
- [ ] Custom sampling rates
- [ ] Integration with monitoring services (DataDog, Sentry)
- [ ] Performance metrics alongside errors
- [ ] User session replay capture
- [ ] A/B testing impact analysis
