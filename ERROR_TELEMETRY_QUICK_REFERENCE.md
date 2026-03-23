# Error Telemetry Quick Reference

## Basic Usage

### Capture an Error
```typescript
import { useErrorTelemetry } from '@/contexts/ErrorTelemetryContext';

export function MyComponent() {
  const { captureError } = useErrorTelemetry();

  try {
    // ... some operation
  } catch (error) {
    captureError('Operation failed', {
      error,
      operation: 'updateProfile',
      severity: 'high'
    });
  }
}
```

### Add Breadcrumbs
```typescript
const { addBreadcrumb } = useErrorTelemetry();

addBreadcrumb('User clicked delete button', 'info');
addBreadcrumb('Network request started', 'info');
addBreadcrumb('API returned 500', 'warning');
```

### Set User Context
```typescript
const { setErrorContext } = useErrorTelemetry();

useEffect(() => {
  setErrorContext({
    userId: user.id,
    userRole: user.role,
    schoolId: user.schoolId
  });
}, [user]);
```

---

## Common Patterns

### Handle API Errors
```typescript
const { captureError } = useErrorTelemetry();

try {
  const response = await fetch('/api/students');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
} catch (error) {
  captureError('Failed to fetch students', {
    error,
    operation: 'fetchStudents',
    severity: 'high',
    context: { endpoint: '/api/students' }
  });
}
```

### Database Operations
```typescript
try {
  const { data, error } = await supabase
    .from('students')
    .select('*');

  if (error) throw error;
} catch (error) {
  captureError('Database query failed', {
    error,
    operation: 'selectStudents',
    severity: 'high',
    tags: { table: 'students' }
  });
}
```

### Form Submission
```typescript
const { captureError, addBreadcrumb } = useErrorTelemetry();

const handleSubmit = async (data) => {
  addBreadcrumb('Form submitted', 'info');
  
  try {
    const result = await api.save(data);
    addBreadcrumb('Form submission successful', 'info');
  } catch (error) {
    addBreadcrumb('Form submission failed', 'warning');
    captureError('Failed to save profile', {
      error,
      operation: 'saveProfile',
      severity: 'medium',
      context: { fields: Object.keys(data) }
    });
  }
};
```

### Async Operations
```typescript
const { captureError, addBreadcrumb } = useErrorTelemetry();

const fetchData = async () => {
  addBreadcrumb('Data fetch started', 'info');
  
  try {
    const data = await fetch('/api/data').then(r => r.json());
    addBreadcrumb('Data fetch completed', 'info');
    return data;
  } catch (error) {
    captureError('Data fetch failed', {
      error,
      operation: 'fetchData',
      severity: 'high'
    });
    throw error; // Re-throw for UI handling
  }
};
```

---

## Severity Levels

| Level | Use When | Examples |
|-------|----------|----------|
| **critical** | App-breaking issues | System down, all requests failing |
| **high** | Important operations fail | Auth failed, database down, API timeout |
| **medium** | Partial functionality affected | Single query fails, network intermittent |
| **low** | Non-critical issues | Validation failure, cache miss, retry success |

---

## Common Error Types

### Network Errors
```typescript
captureError('Network request timeout', {
  error: timeoutError,
  errorType: 'NETWORK',
  severity: 'medium'
});
```

### Database Errors
```typescript
captureError('Database update failed', {
  error: dbError,
  errorType: 'DATABASE',
  operation: 'updateStudent',
  severity: 'high'
});
```

### Authentication Errors
```typescript
captureError('User session expired', {
  error: authError,
  errorType: 'AUTHENTICATION',
  severity: 'high'
});
```

### Validation Errors
```typescript
captureError('Invalid email format', {
  error: validationError,
  errorType: 'VALIDATION',
  severity: 'low'
});
```

---

## Tagging Errors

Add tags to group related errors:
```typescript
captureError('Search failed', {
  error,
  tags: {
    feature: 'search',
    scope: 'students',
    filter: 'name'
  }
});
```

Common tags:
- `feature`: Feature name (students, teachers, attendance)
- `component`: React component name
- `operation`: What was being done
- `scope`: What data/entity was involved
- `service`: Which service (supabase, api, realtime)

---

## Without useErrorTelemetry Hook

If hook not available, use service directly:
```typescript
import { errorTelemetry } from '@/lib/error-telemetry';

errorTelemetry.captureError('Operation failed', {
  error,
  severity: 'high'
});
```

---

## Monitoring Queue

Check pending errors:
```typescript
import { errorTelemetry } from '@/lib/error-telemetry';

const status = errorTelemetry.getQueueStatus();
console.log('Pending errors:', status.queueSize);
console.log('Circuit breaker:', status.circuitBreakerOpen);
```

---

## Environment Variables

### Production Setup
```
VITE_ERROR_TELEMETRY_ENDPOINT=https://api.yourdomain.com/errors
VITE_APP_VERSION=1.0.0
```

### Development
Leave `VITE_ERROR_TELEMETRY_ENDPOINT` empty.
Errors will be logged to console only.

---

## Debugging

### View Console Logs (Dev)
```
[ErrorTelemetry] Error captured: Network timeout
[ErrorTelemetry] Sending 5 errors to telemetry service
[ErrorTelemetry] Circuit breaker opened
```

### Check in Browser Console
```javascript
// View telemetry status
window.errorTelemetry?.getQueueStatus()

// Manually trigger flush
// window.errorTelemetry?.flush()
```

---

## Best Practices

✅ **DO:**
- Include error objects, not just messages
- Add useful context (user, operation, IDs)
- Use appropriate severity levels
- Add breadcrumbs for user actions
- Tag errors for grouping

❌ **DON'T:**
- Capture the same error multiple times
- Send sensitive data (passwords, tokens)
- Create too many breadcrumbs
- Mix concerns (capture app error, not lib error)
- Forget to handle errors after capture

---

## Migration Guide

### From Old Error Handling
```typescript
// OLD
console.error('Failed:', error);
toast.error('Something went wrong');

// NEW
const { captureError } = useErrorTelemetry();
captureError('Operation failed', {
  error,
  operation: 'specificOperation',
  severity: 'high'
});
toast.error('Something went wrong');
```

---

## Testing

### Simulate Errors (Dev Only)
```typescript
import { errorTelemetry } from '@/lib/error-telemetry';

// Trigger test error
errorTelemetry.captureError('Test error', {
  error: new Error('This is a test'),
  tags: { test: true }
});
```

### Check if Integrated
In browser console:
```javascript
typeof window.errorTelemetry // Should be 'object'
```
