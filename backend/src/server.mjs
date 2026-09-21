import http from 'node:http';
import { getConfig } from './env.mjs';
import { RedisCache } from './redis.mjs';
import { SupabaseRestClient } from './supabase-rest.mjs';
import { PublicReadService, numberParam } from './public-read-service.mjs';
import { BackendMetrics } from './metrics.mjs';

const config = getConfig();
const cache = new RedisCache(config);
const supabase = new SupabaseRestClient(config);
const publicRead = new PublicReadService({ supabase, cache, ttl: config.cacheTtl });
const metrics = new BackendMetrics();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

// Per-IP fixed-window limiter (in-memory, per instance). The endpoints are
// public and each cache miss costs a service-key query, so an unthrottled
// caller could hammer Supabase / Upstash through us.
const rateBuckets = new Map();
function clientIp(req) {
  // The leftmost X-Forwarded-For entry is supplied by the caller and can be spoofed to dodge the limiter.
  // Trust only what our own proxy appended: the entry `trustedProxyHops` from the right.
  const hops = config.trustedProxyHops;
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (hops > 0 && forwarded.length) return forwarded[Math.max(0, forwarded.length - hops)];
  return req.socket.remoteAddress || 'unknown';
}
function overRateLimit(req) {
  const now = Date.now();
  const ip = clientIp(req);
  let bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    if (rateBuckets.size > 20_000) {
      for (const [key, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(key);
      if (rateBuckets.size > 20_000) rateBuckets.clear();
    }
    bucket = { count: 0, resetAt: now + 60_000 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count > config.rateLimitPerMinute;
}

function hasMetricsAccess(req) {
  if (!config.metricsToken) return false;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (supplied.length !== config.metricsToken.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i += 1) diff |= supplied.charCodeAt(i) ^ config.metricsToken.charCodeAt(i);
  return diff === 0;
}

function sendJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    ...corsHeaders,
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

function sendError(res, error) {
  // Only our own 4xx validation messages are shown; everything else is generic.
  const status = error.status || 500;
  sendJson(res, status, {
    error: status >= 400 && status < 500 ? error.message || 'Bad request.' : 'Backend API error.',
  });
}

function routeFromPath(pathname) {
  if (pathname === '/api/feed') return { type: 'feed' };
  if (pathname === '/api/events') return { type: 'events' };

  const eventMatch = pathname.match(/^\/api\/events\/([^/]+)$/);
  if (eventMatch) return { type: 'event', id: decodeURIComponent(eventMatch[1]) };

  const profileMatch = pathname.match(/^\/api\/profiles\/([^/]+)$/);
  if (profileMatch) return { type: 'profile', id: decodeURIComponent(profileMatch[1]) };

  return null;
}

async function handlePublicRead(req, res, url) {
  const facadeType = url.pathname === '/api/public-read' ? url.searchParams.get('type') || 'feed' : null;
  const route = facadeType ? { type: facadeType } : routeFromPath(url.pathname);
  if (!route) return false;

  const limit = numberParam(url, 'limit', 20, 1, 50);
  const offset = numberParam(url, 'offset', 0, 0, 1000);
  const id = route.id || String(url.searchParams.get('id') || '').trim();
  const ids = String(url.searchParams.get('ids') || '').trim();
  const organizerId = String(url.searchParams.get('organizerId') || '').trim();
  const started = performance.now();
  const result = await publicRead.read(route.type, { limit, offset, id, ids, organizerId });
  const latencyMs = performance.now() - started;
  metrics.record({
    endpoint: route.type,
    status: 200,
    latencyMs,
    cacheState: result.cacheState,
  });

  sendJson(res, 200, result.data, {
    'x-duvela-cache': result.cacheState,
    'x-duvela-cache-store': result.cacheStore || '',
    'x-duvela-api': 'backend',
    'x-duvela-duration-ms': String(Math.round(latencyMs)),
  });
  return true;
}

const server = http.createServer(async (req, res) => {
  const requestStarted = performance.now();
  let routeName = 'other';
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    routeName = url.pathname;

    if (url.pathname === '/health') {
      // Liveness only. It used to run a Redis SET/GET on every call and echo
      // upstream error text — a free lever on the Upstash quota for anyone.
      sendJson(res, 200, { ok: true, service: 'duvela-backend-api' }, { 'Cache-Control': 'no-store' });
      return;
    }

    if (url.pathname === '/metrics' || url.pathname === '/metrics.prom') {
      if (!hasMetricsAccess(req)) {
        sendJson(res, 404, { error: 'Not found.' });
        return;
      }
      if (url.pathname === '/metrics') sendJson(res, 200, metrics.snapshot(), { 'Cache-Control': 'no-store' });
      else sendText(res, 200, metrics.prometheus());
      return;
    }

    if (overRateLimit(req)) {
      routeName = 'rate-limited';
      metrics.record({ endpoint: routeName, status: 429, latencyMs: performance.now() - requestStarted });
      sendJson(res, 429, { error: 'Too many requests.' }, { 'Retry-After': '60' });
      return;
    }

    if (await handlePublicRead(req, res, url)) return;

    routeName = 'other';
    metrics.record({ endpoint: routeName, status: 404, latencyMs: performance.now() - requestStarted });
    sendJson(res, 404, { error: 'Not found.' });
  } catch (error) {
    const status = error.status || 500;
    metrics.record({ endpoint: routeName, status, latencyMs: performance.now() - requestStarted });
    console.error(JSON.stringify({
      level: 'error',
      status,
      endpoint: routeName,
      message: error.message || 'Backend API error.',
      upstream: error.upstream || undefined,
    }));
    sendError(res, error);
  }
});

server.listen(config.port, config.host, () => {
  console.log(`DUVELA Backend API listening on http://${config.host}:${config.port}`);
});
