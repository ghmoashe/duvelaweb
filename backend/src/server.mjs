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
};

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
  sendJson(res, error.status || 500, {
    error: error.message || 'Backend API error.',
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

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    routeName = url.pathname;

    if (url.pathname === '/health') {
      const redisTest = await cache.selfTest().catch((error) => ({
        configured: cache.enabled,
        ok: false,
        error: error.message || String(error),
      }));
      sendJson(res, 200, {
        ok: true,
        service: 'duvela-backend-api',
        runtime: 'node',
        supabase: supabase.configured ? 'configured' : 'missing',
        redis: cache.enabled ? 'configured' : 'disabled',
        redisTest,
        memoryCache: 'enabled',
      }, { 'Cache-Control': 'no-store' });
      return;
    }

    if (url.pathname === '/metrics') {
      sendJson(res, 200, metrics.snapshot(), { 'Cache-Control': 'no-store' });
      return;
    }

    if (url.pathname === '/metrics.prom') {
      sendText(res, 200, metrics.prometheus());
      return;
    }

    if (await handlePublicRead(req, res, url)) return;

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
    }));
    sendError(res, error);
  }
});

server.listen(config.port, config.host, () => {
  console.log(`DUVELA Backend API listening on http://${config.host}:${config.port}`);
});
