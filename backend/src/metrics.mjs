const startedAt = Date.now();

function emptyEndpointMetrics() {
  return {
    requests: 0,
    errors: 0,
    latencyMsTotal: 0,
    latencyMsMax: 0,
    cache: {
      hit: 0,
      miss: 0,
      disabled: 0,
      error: 0,
    },
  };
}

export class BackendMetrics {
  constructor() {
    this.requests = 0;
    this.errors = 0;
    this.status = {};
    this.endpoints = {};
  }

  endpoint(name) {
    // Endpoint names come from request paths; cap the label set so a scanner
    // hitting random URLs cannot grow this object (and /metrics.prom) forever.
    if (!this.endpoints[name] && Object.keys(this.endpoints).length >= 30) name = 'other';
    if (!this.endpoints[name]) this.endpoints[name] = emptyEndpointMetrics();
    return this.endpoints[name];
  }

  record({ endpoint = 'unknown', status = 200, latencyMs = 0, cacheState = null }) {
    this.requests += 1;
    const statusFamily = `${Math.floor(status / 100)}xx`;
    this.status[statusFamily] = (this.status[statusFamily] || 0) + 1;
    if (status >= 500) this.errors += 1;

    const metrics = this.endpoint(endpoint);
    metrics.requests += 1;
    if (status >= 400) metrics.errors += 1;
    metrics.latencyMsTotal += latencyMs;
    metrics.latencyMsMax = Math.max(metrics.latencyMsMax, latencyMs);
    if (cacheState && Object.hasOwn(metrics.cache, cacheState)) {
      metrics.cache[cacheState] += 1;
    }
  }

  snapshot() {
    const endpoints = {};
    for (const [name, metrics] of Object.entries(this.endpoints)) {
      endpoints[name] = {
        ...metrics,
        latencyMsAvg: metrics.requests ? metrics.latencyMsTotal / metrics.requests : 0,
      };
    }
    return {
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      requests: this.requests,
      errors: this.errors,
      status: this.status,
      endpoints,
    };
  }

  prometheus() {
    const snapshot = this.snapshot();
    const lines = [
      '# HELP duvela_backend_uptime_seconds Backend process uptime.',
      '# TYPE duvela_backend_uptime_seconds gauge',
      `duvela_backend_uptime_seconds ${snapshot.uptimeSeconds}`,
      '# HELP duvela_backend_requests_total Backend requests.',
      '# TYPE duvela_backend_requests_total counter',
      `duvela_backend_requests_total ${snapshot.requests}`,
      '# HELP duvela_backend_errors_total Backend 5xx errors.',
      '# TYPE duvela_backend_errors_total counter',
      `duvela_backend_errors_total ${snapshot.errors}`,
    ];

    for (const [family, count] of Object.entries(snapshot.status)) {
      lines.push(`duvela_backend_status_total{family="${family}"} ${count}`);
    }

    for (const [endpoint, metrics] of Object.entries(snapshot.endpoints)) {
      lines.push(`duvela_backend_endpoint_requests_total{endpoint="${endpoint}"} ${metrics.requests}`);
      lines.push(`duvela_backend_endpoint_errors_total{endpoint="${endpoint}"} ${metrics.errors}`);
      lines.push(`duvela_backend_endpoint_latency_ms_avg{endpoint="${endpoint}"} ${metrics.latencyMsAvg}`);
      lines.push(`duvela_backend_endpoint_latency_ms_max{endpoint="${endpoint}"} ${metrics.latencyMsMax}`);
      for (const [state, count] of Object.entries(metrics.cache)) {
        lines.push(`duvela_backend_cache_total{endpoint="${endpoint}",state="${state}"} ${count}`);
      }
    }

    return `${lines.join('\n')}\n`;
  }
}
