import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const SUPABASE_URL = (__ENV.STAGING_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = __ENV.STAGING_SUPABASE_ANON_KEY || '';
const PUBLIC_API_URL = (__ENV.STAGING_PUBLIC_API_URL || '').replace(/\/+$/, '');
const TARGET = __ENV.LOAD_TARGET || '100';
const DURATION = __ENV.LOAD_DURATION || '5m';
const RAMP_DURATION = __ENV.LOAD_RAMP_DURATION || '0s';
const PAGE_SIZE = Number(__ENV.PAGE_SIZE || 20);
const RETRIES = Number(__ENV.LOAD_RETRIES || 2);
const THINK_TIME_MIN = Number(__ENV.THINK_TIME_MIN || 0.5);
const THINK_TIME_MAX = Number(__ENV.THINK_TIME_MAX || 2);
const DEBUG_FAILURES = __ENV.DEBUG_FAILURES === '1';
const PREWARM_CACHE = __ENV.PREWARM_CACHE !== '0';
const PRODUCTION_SUPABASE_URL = 'https://ohtkryanqcnwghcnipsr.supabase.co';

const scenario =
  RAMP_DURATION && RAMP_DURATION !== '0' && RAMP_DURATION !== '0s'
    ? {
        executor: 'ramping-vus',
        stages: [
          { duration: RAMP_DURATION, target: Number(TARGET) },
          { duration: DURATION, target: Number(TARGET) },
        ],
        gracefulRampDown: '30s',
      }
    : {
        executor: 'constant-vus',
        vus: Number(TARGET),
        duration: DURATION,
        gracefulStop: '30s',
      };

export const feedLatency = new Trend('duvela_feed_latency', true);
export const eventsLatency = new Trend('duvela_events_latency', true);
export const profilesLatency = new Trend('duvela_profiles_latency', true);
export const apiErrors = new Counter('duvela_api_errors');
export const apiErrorRate = new Rate('duvela_api_error_rate');
export const networkErrors = new Counter('duvela_error_status_0');
export const clientErrors = new Counter('duvela_error_status_4xx');
export const rateLimitErrors = new Counter('duvela_error_status_429');
export const serverErrors = new Counter('duvela_error_status_5xx');
export const feedErrors = new Counter('duvela_endpoint_errors_feed');
export const eventsErrors = new Counter('duvela_endpoint_errors_events');
export const profilesErrors = new Counter('duvela_endpoint_errors_profiles');
export const cacheHits = new Counter('duvela_cache_hits');
export const cacheMisses = new Counter('duvela_cache_misses');
export const cacheDisabled = new Counter('duvela_cache_disabled');
export const cacheErrors = new Counter('duvela_cache_errors');
export const cacheMemory = new Counter('duvela_cache_store_memory');
export const cacheRedis = new Counter('duvela_cache_store_redis');

export const options = {
  scenarios: {
    feed_events_profiles: scenario,
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    duvela_api_error_rate: ['rate<0.01'],
    duvela_feed_latency: ['p(95)<500'],
    duvela_events_latency: ['p(95)<500'],
    duvela_profiles_latency: ['p(95)<500'],
  },
  summaryTrendStats: ['min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function requireEnv() {
  if (PUBLIC_API_URL) {
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Set STAGING_SUPABASE_URL and STAGING_SUPABASE_ANON_KEY before running this test.');
  }
  if (SUPABASE_URL === PRODUCTION_SUPABASE_URL && __ENV.ALLOW_PRODUCTION_LOAD_TEST !== '1') {
    throw new Error('Refusing to run against production Supabase. Use staging or set ALLOW_PRODUCTION_LOAD_TEST=1 intentionally.');
  }
}

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
};

function rest(path, params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const url = `${SUPABASE_URL}/rest/v1/${path}${query ? `?${query}` : ''}`;
  let response = http.get(url, { headers, tags: { endpoint: path } });
  for (let attempt = 0; attempt < RETRIES && shouldRetry(response); attempt += 1) {
    sleep(0.2 * (attempt + 1));
    response = http.get(url, { headers, tags: { endpoint: path, retry: String(attempt + 1) } });
  }
  recordApiResult(response, path);
  if (!(response.status >= 200 && response.status < 300) && DEBUG_FAILURES) {
    console.error(`duvela_api_failure endpoint=${path} status=${response.status} url=${url} body=${String(response.body || '').slice(0, 240)}`);
  }
  return response;
}

function publicApi(type, params = {}) {
  if (!PUBLIC_API_URL) return null;
  const url = buildPublicApiUrl(type, params);
  let response = http.get(url, { headers, tags: { endpoint: `public-${type}` } });
  for (let attempt = 0; attempt < RETRIES && shouldRetry(response); attempt += 1) {
    sleep(0.2 * (attempt + 1));
    response = http.get(url, { headers, tags: { endpoint: `public-${type}`, retry: String(attempt + 1) } });
  }
  recordApiResult(response, type === 'feed' ? 'posts' : type === 'profile' ? 'profiles' : 'events');
  recordCacheResult(response);
  if (!(response.status >= 200 && response.status < 300) && DEBUG_FAILURES) {
    console.error(`duvela_api_failure endpoint=public-${type} status=${response.status} cache=${response.headers['X-Duvela-Cache'] || ''} url=${url} body=${String(response.body || '').slice(0, 240)}`);
  }
  return response;
}

function publicApiOrRest(type, publicParams, path, restParams) {
  if (PUBLIC_API_URL) {
    return publicApi(type, publicParams);
  }
  return rest(path, restParams);
}

function buildPublicApiUrl(type, params = {}) {
  const query = Object.entries({ type, ...params })
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `${PUBLIC_API_URL}${PUBLIC_API_URL.includes('?') ? '&' : '?'}${query}`;
}

function prewarmPublicApi(pageSize) {
  if (!PUBLIC_API_URL || !PREWARM_CACHE) return;
  for (let offset = 0; offset <= pageSize * 5; offset += pageSize) {
    http.get(buildPublicApiUrl('feed', { limit: pageSize, offset }), { headers, tags: { endpoint: 'prewarm-feed' } });
    const events = http.get(buildPublicApiUrl('events', { limit: pageSize, offset }), { headers, tags: { endpoint: 'prewarm-events' } });
    const rows = jsonArray(events);
    const event = rows[0];
    if (event?.id) http.get(buildPublicApiUrl('event', { id: event.id }), { headers, tags: { endpoint: 'prewarm-event' } });
    if (event?.organizer_id) http.get(buildPublicApiUrl('profile', { id: event.organizer_id }), { headers, tags: { endpoint: 'prewarm-profile' } });
  }
}

function recordCacheResult(response) {
  const state = String(response.headers['X-Duvela-Cache'] || '').toLowerCase();
  const store = String(response.headers['X-Duvela-Cache-Store'] || '').toLowerCase();
  if (state === 'hit') cacheHits.add(1);
  if (state === 'miss') cacheMisses.add(1);
  if (state === 'disabled') cacheDisabled.add(1);
  if (state === 'error') cacheErrors.add(1);
  if (store === 'memory') cacheMemory.add(1);
  if (store === 'redis') cacheRedis.add(1);
}

function recordApiResult(response, path) {
  const ok = response.status >= 200 && response.status < 300;
  apiErrorRate.add(!ok);
  if (!ok) {
    apiErrors.add(1);
    if (response.status === 0) networkErrors.add(1);
    if (response.status >= 400 && response.status < 500) clientErrors.add(1);
    if (response.status === 429) rateLimitErrors.add(1);
    if (response.status >= 500) serverErrors.add(1);
    if (path === 'posts') feedErrors.add(1);
    if (path === 'events') eventsErrors.add(1);
    if (path === 'profiles') profilesErrors.add(1);
  }
}

function shouldRetry(response) {
  return response.status === 0 || response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
}

function jsonArray(response) {
  try {
    const data = response.json();
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function pick(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function record(trend, response) {
  trend.add(response.timings.duration);
}

function think() {
  const min = Math.max(0, THINK_TIME_MIN);
  const max = Math.max(min, THINK_TIME_MAX);
  sleep(Math.random() * (max - min) + min);
}

export function setup() {
  requireEnv();
  prewarmPublicApi(PAGE_SIZE);
  return { pageSize: PAGE_SIZE };
}

export default function (data) {
  const pageSize = data.pageSize || 20;
  const offset = Math.floor(Math.random() * 5) * pageSize;

  group('feed page', () => {
    const feed = publicApiOrRest('feed', { limit: pageSize, offset }, 'posts', {
      select: 'id,user_id,media_url,media_type,caption,cover_url,mux_playback_id,mux_thumbnail_url,language_level,created_at',
      media_type: 'in.(video,youtube,image)',
      media_url: 'not.is.null',
      order: 'created_at.desc',
      limit: pageSize,
      offset,
    });
    record(feedLatency, feed);
    check(feed, {
      'feed status 2xx': (r) => r.status >= 200 && r.status < 300,
      'feed returns <= page size': (r) => jsonArray(r).length <= pageSize,
    });

    const feedRows = jsonArray(feed);
    const post = pick(feedRows);
    if (post && post.user_id) {
      const profile = publicApiOrRest('profile', { id: post.user_id }, 'profiles', {
        select: 'id,full_name,avatar_url,city,country,bio,is_teacher',
        id: `eq.${post.user_id}`,
        limit: 1,
      });
      record(profilesLatency, profile);
      check(profile, { 'feed author profile status 2xx': (r) => r.status >= 200 && r.status < 300 });
    }
  });

  think();

  group('events and profiles', () => {
      const events = publicApiOrRest('events', { limit: pageSize, offset }, 'events', {
      select: 'id,title,description,event_date,event_time,city,country,format,language,is_paid,price_amount,max_participants,image_url,organizer_id,recurrence_group_id',
      order: 'event_date.asc',
      limit: pageSize,
      offset,
    });
    record(eventsLatency, events);
    check(events, {
      'events status 2xx': (r) => r.status >= 200 && r.status < 300,
      'events returns <= page size': (r) => jsonArray(r).length <= pageSize,
    });

    const event = pick(jsonArray(events));
    if (event && event.id) {
      const eventDetail = publicApiOrRest('event', { id: event.id }, 'events', {
        select: 'id,title,description,event_date,event_time,city,country,format,language,is_paid,price_amount,max_participants,image_url,organizer_id,recurrence_group_id',
        id: `eq.${event.id}`,
        limit: 1,
      });
      record(eventsLatency, eventDetail);
      check(eventDetail, { 'event detail status 2xx': (r) => r.status >= 200 && r.status < 300 });
    }

    if (event && event.organizer_id) {
      const organizer = publicApiOrRest('profile', { id: event.organizer_id }, 'profiles', {
        select: 'id,full_name,avatar_url,city,country,bio,is_teacher',
        id: `eq.${event.organizer_id}`,
        limit: 1,
      });
      record(profilesLatency, organizer);
      check(organizer, { 'organizer profile status 2xx': (r) => r.status >= 200 && r.status < 300 });
    }
  });

  think();

  group('pagination', () => {
    const nextOffset = offset + pageSize;
    const feedNext = publicApiOrRest('feed', { limit: pageSize, offset: nextOffset }, 'posts', {
      select: 'id,user_id,media_url,media_type,caption,cover_url,mux_playback_id,mux_thumbnail_url,language_level,created_at',
      media_type: 'in.(video,youtube,image)',
      media_url: 'not.is.null',
      order: 'created_at.desc',
      limit: pageSize,
      offset: nextOffset,
    });
    record(feedLatency, feedNext);
    check(feedNext, { 'feed pagination status 2xx': (r) => r.status >= 200 && r.status < 300 });

    const eventsNext = publicApiOrRest('events', { limit: pageSize, offset: nextOffset }, 'events', {
      select: 'id,title,description,event_date,event_time,city,country,format,language,is_paid,price_amount,max_participants,image_url,organizer_id,recurrence_group_id',
      order: 'event_date.asc',
      limit: pageSize,
      offset: nextOffset,
    });
    record(eventsLatency, eventsNext);
    check(eventsNext, { 'events pagination status 2xx': (r) => r.status >= 200 && r.status < 300 });
  });
}
