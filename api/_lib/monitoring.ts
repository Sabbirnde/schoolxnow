import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = {
  requestId: string;
  endpoint: string;
  method: string;
  userRole?: string;
};

type AlertType = 'login_failure' | 'http_500' | 'database_connection_failure' | 'client_error';

const requestStorage = new AsyncLocalStorage<RequestContext>();
const signalWindows = new Map<AlertType, number[]>();
const latencySamples = new Map<string, number[]>();

const ALERT_POLICIES: Record<AlertType, { threshold: number; windowMs: number }> = {
  login_failure: { threshold: 5, windowMs: 5 * 60_000 },
  http_500: { threshold: 5, windowMs: 60_000 },
  database_connection_failure: { threshold: 1, windowMs: 60_000 },
  client_error: { threshold: 10, windowMs: 5 * 60_000 },
};

export function withRequestContext<T>(context: RequestContext, fn: () => Promise<T>) {
  return requestStorage.run(context, fn);
}

export function requestContext() {
  return requestStorage.getStore();
}

export function setRequestUserRole(role: string | undefined) {
  const context = requestStorage.getStore();
  if (context && role) {
    context.userRole = role;
  }
}

export function sanitizedError(error: unknown) {
  const candidate = error as {
    name?: string;
    code?: string;
    errno?: number;
    sqlState?: string;
  };

  return {
    name: candidate?.name || 'Error',
    code: candidate?.code || undefined,
    errno: candidate?.errno || undefined,
    sqlState: candidate?.sqlState || undefined,
  };
}

export function logMySqlError(error: unknown, operation: string) {
  const context = requestContext();
  console.error(JSON.stringify({
    event: 'mysql_error',
    operation,
    request_id: context?.requestId,
    endpoint: context?.endpoint,
    method: context?.method,
    user_role: context?.userRole || 'anonymous',
    error: sanitizedError(error),
    timestamp: new Date().toISOString(),
  }));
}

function isDatabaseConnectionFailure(error: unknown) {
  const code = String((error as { code?: string })?.code || '');
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
    'HANDSHAKE_SSL_ERROR',
    'ER_ACCESS_DENIED_ERROR',
  ].includes(code);
}

export function monitorDatabaseError(error: unknown) {
  if (isDatabaseConnectionFailure(error)) {
    recordAlertSignal('database_connection_failure', { error: sanitizedError(error) });
  }
}

const percentile = (values: number[], value: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(Math.ceil((value / 100) * sorted.length) - 1, sorted.length - 1)];
};

export function recordLatencyMetric(
  metric: 'api_latency' | 'mysql_query_duration',
  name: string,
  durationMs: number,
  details: Record<string, unknown> = {},
) {
  const key = `${metric}:${name}`;
  const samples = [...(latencySamples.get(key) || []), Math.round(durationMs)].slice(-200);
  latencySamples.set(key, samples);
  console.info(JSON.stringify({
    event: 'performance_metric',
    metric,
    name,
    duration_ms: Math.round(durationMs),
    sample_count: samples.length,
    p50_ms: percentile(samples, 50),
    p95_ms: percentile(samples, 95),
    p99_ms: percentile(samples, 99),
    request_id: requestContext()?.requestId,
    ...details,
    timestamp: new Date().toISOString(),
  }));
}

export function recordAlertSignal(type: AlertType, details: Record<string, unknown> = {}) {
  const now = Date.now();
  const policy = ALERT_POLICIES[type];
  const recent = (signalWindows.get(type) || []).filter((timestamp) => now - timestamp < policy.windowMs);
  recent.push(now);
  signalWindows.set(type, recent);

  console.warn(JSON.stringify({
    event: 'monitoring_signal',
    signal: type,
    count: recent.length,
    window_seconds: policy.windowMs / 1000,
    request_id: requestContext()?.requestId,
    endpoint: requestContext()?.endpoint,
    user_role: requestContext()?.userRole || 'anonymous',
    timestamp: new Date(now).toISOString(),
  }));

  if (recent.length === policy.threshold) {
    void sendAlert(type, recent.length, policy.windowMs / 1000, details);
  }
}

async function sendAlert(
  type: AlertType,
  count: number,
  windowSeconds: number,
  details: Record<string, unknown>,
) {
  const context = requestContext();
  const payload = {
    event: 'schoolxnow_alert',
    alert: type,
    count,
    window_seconds: windowSeconds,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    request_id: context?.requestId,
    endpoint: context?.endpoint,
    user_role: context?.userRole || 'anonymous',
    details,
    timestamp: new Date().toISOString(),
  };

  console.error(JSON.stringify(payload));
  const webhook = process.env.ALERT_WEBHOOK_URL;
  if (!webhook) {
    return;
  }

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'alert_delivery_failure',
      alert: type,
      request_id: context?.requestId,
      error: sanitizedError(error),
      timestamp: new Date().toISOString(),
    }));
  }
}
