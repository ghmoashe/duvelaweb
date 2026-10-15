const fallbackSupabaseUrl = 'https://ohtkryanqcnwghcnipsr.supabase.co';
const fallbackSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU';

const memory = globalThis.__duvelaApiMemoryCache || new Map();
globalThis.__duvelaApiMemoryCache = memory;

const metrics = globalThis.__duvelaApiMetrics || {
  startedAt: Date.now(),
  requests: 0,
  errors: 0,
  cache: { hit: 0, miss: 0, error: 0 },
  lastCacheSetError: null,
};
globalThis.__duvelaApiMetrics = metrics;

const feedSelect = [
  'id',
  'user_id',
  'media_url',
  'media_type',
  'caption',
  'cover_url',
  'language',
  'mux_playback_id',
  'mux_thumbnail_url',
  'bunny_video_guid',
  'bunny_thumbnail_url',
  'bunny_view_count',
  'bunny_watch_time_seconds',
  'bunny_length_seconds',
  'bunny_status',
  'language_level',
  'shorts_hidden',
  'shorts_visibility',
  'shorts_deleted_at',
  'created_at',
].join(',');

const eventSelect = [
  'id',
  'title',
  'description',
  'event_date',
  'event_time',
  'city',
  'country',
  'format',
  'language',
  'language_level',
  'language_level_min',
  'language_level_max',
  'duration_minutes',
  'is_paid',
  'price_amount',
  'max_participants',
  'image_url',
  'image_urls',
  'organizer_id',
  'recurrence_group_id',
  'created_at',
].join(',');

// Reviewed publication view only; never read the base profile table here.
// This handler can run with the service key (RLS bypassed) and answers
// unauthenticated requests for any profile id, so the only thing standing
// between a profile's private fields and any caller is reading from
// public_profiles_v2 instead of profiles: that view already encodes the
// owner's reviewed publication consent and their approved-field selection.
// Clients read their OWN profile straight from Supabase with the user's
// session instead.
const profileSelect = [
  'id',
  'full_name',
  'avatar_url',
  'cover_url',
  'city',
  'country',
  'bio',
  'language',
  'language_level',
  'teaches_languages',
  'explanation_languages',
  'qualifications',
  'specialization',
  'teaching_experience',
  'teacher_audience',
  'is_teacher',
  'is_organizer',
  'is_verified',
  'score',
  'registered_web_role',
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'linkedin',
  'website',
].join(',');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function config() {
  return {
    supabaseUrl: String(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl).replace(/\/+$/, ''),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey,
    redisRestUrl: String(process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, ''),
    redisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  };
}

function numberParam(url, name, fallback, min, max) {
  const value = Number(url.searchParams.get(name) || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function json(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,OPTIONS');
  res.setHeader('access-control-allow-headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

async function redisCommand(command) {
  const cfg = config();
  if (!cfg.redisRestUrl || !cfg.redisRestToken) return { disabled: true, result: null };
  const response = await fetch(cfg.redisRestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.redisRestToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.error) throw new Error(String(body?.error || `Redis ${response.status}`));
  return { disabled: false, result: body?.result ?? null };
}

function getMemory(key) {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function setMemory(key, value, ttlSeconds) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function cacheGet(key) {
  const memoryValue = getMemory(key);
  if (memoryValue) return { state: 'hit', store: 'memory', value: memoryValue };

  const result = await redisCommand(['GET', key]);
  if (result.disabled) return { state: 'miss', store: 'memory', value: null };
  if (!result.result) return { state: 'miss', store: 'redis', value: null };
  return { state: 'hit', store: 'redis', value: JSON.parse(String(result.result)) };
}

async function cacheSet(key, value, ttlSeconds) {
  setMemory(key, value, ttlSeconds);
  const cfg = config();
  if (cfg.redisRestUrl && cfg.redisRestToken) {
    try {
      await redisCommand(['SET', key, JSON.stringify(value), 'EX', ttlSeconds]);
      metrics.lastCacheSetError = null;
    } catch (error) {
      metrics.lastCacheSetError = error?.message || String(error);
      throw error;
    }
  }
}

async function redisSelfTest() {
  const cfg = config();
  if (!cfg.redisRestUrl || !cfg.redisRestToken) return { configured: false, ok: false };
  const key = `duvela:health:${Date.now()}`;
  const value = `ok:${Date.now()}`;
  await redisCommand(['SET', key, value, 'EX', 30]);
  const result = await redisCommand(['GET', key]);
  return { configured: true, ok: result.result === value };
}

async function supabaseGet(path, params) {
  const cfg = config();
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const response = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}?${query}`, {
    headers: {
      apikey: cfg.supabaseKey,
      authorization: `Bearer ${cfg.supabaseKey}`,
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    // Upstream messages can name tables/columns — log, never relay.
    console.error('supabase error', response.status, body?.message || body?.error || '');
    const error = new Error(`Upstream error ${response.status}`);
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return Array.isArray(body) ? body : [];
}

function idListParam(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50)
    .sort()
    .filter((item, index, list) => index === 0 || item !== list[index - 1]);
}

async function readPublicData(type, { limit, offset, id, ids, organizerId }) {
  if (id && !UUID_RE.test(id)) throw badRequest('Invalid id.');
  if (organizerId && !UUID_RE.test(organizerId)) throw badRequest('Invalid organizerId.');
  const normalizedIds = idListParam(ids);
  if (normalizedIds.some((item) => !UUID_RE.test(item))) throw badRequest('Invalid ids.');
  const cacheKey = [
    'vercel-api:v2',
    type,
    limit,
    offset,
    id || '',
    normalizedIds.join(','),
    organizerId || '',
  ].join(':');
  let cacheState = 'disabled';
  let cacheStore = 'memory';

  if (type !== 'profile' && type !== 'profiles') {
    try {
      const cached = await cacheGet(cacheKey);
      cacheState = cached.state;
      cacheStore = cached.store;
      if (cached.value) return { data: cached.value, cacheState, cacheStore };
    } catch (_) {
      cacheState = 'error';
      metrics.cache.error += 1;
    }
  }

  let data;
  if (type === 'feed') {
    data = await supabaseGet('posts', {
      select: feedSelect,
      media_type: 'in.(video,youtube,image)',
      media_url: 'not.is.null',
      // Runs with the service key (RLS bypassed): hide what RLS hides from users.
      shorts_deleted_at: 'is.null',
      or: '(shorts_hidden.is.null,shorts_hidden.eq.false)',
      shorts_visibility: 'eq.public',
      order: 'created_at.desc',
      limit,
      offset,
    });
  } else if (type === 'events') {
    data = await supabaseGet('events', {
      select: eventSelect,
      organizer_id: organizerId ? `eq.${organizerId}` : undefined,
      order: organizerId ? 'event_date.desc' : 'event_date.asc',
      limit,
      offset,
    });
  } else if (type === 'event') {
    data = await supabaseGet('events', { select: eventSelect, id: `eq.${id}`, limit: 1 });
  } else if (type === 'profile') {
    data = await supabaseGet('public_profiles_v2', { select: profileSelect, id: `eq.${id}`, limit: 1 });
  } else if (type === 'profiles') {
    if (normalizedIds.length === 0) {
      data = [];
    } else {
      data = await supabaseGet('public_profiles_v2', { select: profileSelect, id: `in.(${normalizedIds.join(',')})`, limit: normalizedIds.length });
    }
  } else {
    const error = new Error('Unsupported type.');
    error.status = 400;
    throw error;
  }

  // Profile responses are never cached (memory, Redis, CDN or browser): the
  // owner's reviewed publication choice can be revoked at any time, and a
  // shared cache would keep serving a withdrawn projection.
  if (type !== 'profile' && type !== 'profiles') {
    await cacheSet(cacheKey, data, type === 'feed' ? 30 : 120).catch(() => {});
  }
  return { data, cacheState, cacheStore };
}

module.exports = {
  config,
  json,
  metrics,
  numberParam,
  readPublicData,
  redisSelfTest,
};
