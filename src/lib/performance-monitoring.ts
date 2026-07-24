import type { QueryClient } from "@tanstack/react-query";

type MetricBag = Record<string, number>;

const metrics: MetricBag = {};
let cacheHits = 0;
let cacheMisses = 0;
let started = false;

const record = (name: string, value: number) => {
  if (Number.isFinite(value)) metrics[name] = Math.round(value * 100) / 100;
};

const observe = (type: string, callback: (entry: PerformanceEntry) => void) => {
  if (!("PerformanceObserver" in window)) return;
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback));
    observer.observe({ type, buffered: true });
  } catch {
    // Older browsers omit unsupported performance entry types.
  }
};

const collectResourceMetrics = () => {
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const dashboardResources = resources.filter((entry) =>
    entry.name.includes("/api/"),
  );
  const initialScripts = resources.filter((entry) => entry.initiatorType === "script");
  record("dashboard_initial_api_requests", dashboardResources.length);
  record(
    "dashboard_initial_javascript_bytes",
    initialScripts.reduce((total, entry) => total + (entry.transferSize || entry.encodedBodySize), 0),
  );
  const total = cacheHits + cacheMisses;
  record("react_query_cache_hit_rate", total > 0 ? cacheHits / total : 0);
};

const send = () => {
  collectResourceMetrics();
  const body = JSON.stringify({
    metrics,
    page: window.location.pathname,
    timestamp: new Date().toISOString(),
  });
  const endpoint = import.meta.env.VITE_PERFORMANCE_TELEMETRY_ENDPOINT || "/api/telemetry/performance";
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
  } else {
    void fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  }
};

export function startPerformanceMonitoring(queryClient: QueryClient) {
  if (started || typeof window === "undefined") return;
  started = true;

  observe("largest-contentful-paint", (entry) => record("lcp_ms", entry.startTime));
  observe("event", (entry) => {
    const duration = (entry as PerformanceEventTiming).duration;
    if (duration > (metrics.inp_ms || 0)) record("inp_ms", duration);
  });

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "observerAdded") return;
    if (event.query.state.dataUpdatedAt > 0 && !event.query.isStale()) cacheHits += 1;
    else cacheMisses += 1;
  });

  window.addEventListener("load", () => window.setTimeout(send, 10_000), { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
  });
}

export function performanceMetricsSnapshot() {
  collectResourceMetrics();
  return { ...metrics };
}
