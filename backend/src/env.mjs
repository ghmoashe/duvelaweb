import fs from 'node:fs';
import path from 'node:path';

export function loadDotEnv(filePath = path.resolve(process.cwd(), '.env')) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

function numberEnv(name, fallback, min, max) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function backendPort() {
  return numberEnv('BACKEND_PORT', process.env.PORT || 8787, 1, 65535);
}

export function getConfig() {
  loadDotEnv(path.resolve(process.cwd(), '.env.local'));
  loadDotEnv();

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  return {
    env: process.env.NODE_ENV || 'development',
    host: process.env.BACKEND_HOST || '127.0.0.1',
    port: backendPort(),
    supabaseUrl,
    supabaseKey,
    redisRestUrl: (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, ''),
    redisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    // /metrics and /metrics.prom are served only when this is set, and then
    // only with "Authorization: Bearer <token>".
    metricsToken: process.env.METRICS_TOKEN || '',
    rateLimitPerMinute: numberEnv('RATE_LIMIT_PER_MINUTE', 120, 10, 6000),
    // Number of reverse proxies in front of this service that append to X-Forwarded-For (Railway edge = 1).
    // The client IP is the entry that many hops from the RIGHT; anything to its left is client-controlled.
    trustedProxyHops: numberEnv('TRUSTED_PROXY_HOPS', 1, 0, 5),
    cacheTtl: {
      feed: numberEnv('DUVELA_FEED_CACHE_TTL_SECONDS', 30, 5, 3600),
      events: numberEnv('DUVELA_EVENTS_CACHE_TTL_SECONDS', 120, 5, 3600),
      event: numberEnv('DUVELA_EVENT_CACHE_TTL_SECONDS', 120, 5, 3600),
      profile: numberEnv('DUVELA_PROFILE_CACHE_TTL_SECONDS', 300, 5, 3600),
    },
  };
}
