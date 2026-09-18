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

const profileSelect = [
  'id',
  'full_name',
  'avatar_url',
  'cover_url',
  'city',
  'country',
  'language',
  'language_level',
  'learning_languages',
  'practice_languages',
  'teaches_languages',
  'profile_interests',
  'bio',
  'registered_web_role',
  'registered_web_role_confirmed',
  'is_organizer',
  'is_teacher',
  'is_admin',
  'is_verified',
  'app_access',
  'learning_goal',
  'goal_level',
  'weekly_minutes_goal',
  'grammar_progress',
  'speaking_progress',
  'vocabulary_progress',
  'exam_progress',
  'score',
  'score_state_version',
  'duvela_coin_balance:vela_coin_balance',
  'claimed_rewards',
  'learning_targets',
  'practice_progress',
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'linkedin',
  'website',
  'phone',
  'dob',
  'teacher_audience',
  'created_at',
].join(',');

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
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.error || `Supabase ${response.status}`);
  return Array.isArray(body) ? body : [];
}

function idListParam(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

async function readPublicData(type, { limit, offset, id, ids, organizerId }) {
  const normalizedIds = idListParam(ids);
  const cacheKey = [
    'vercel-api:v2',
    type,
    limit,
    offset,
    id || '',
    normalizedIds.join(','),
    organizerId || '',
  ].join(':');
  let cacheState = 'miss';
  let cacheStore = 'memory';

  try {
    const cached = await cacheGet(cacheKey);
    cacheState = cached.state;
    cacheStore = cached.store;
    if (cached.value) return { data: cached.value, cacheState, cacheStore };
  } catch (_) {
    cacheState = 'error';
    metrics.cache.error += 1;
  }

  let data;
  if (type === 'feed') {
    data = await supabaseGet('posts', {
      select: feedSelect,
      media_type: 'in.(video,youtube,image)',
      media_url: 'not.is.null',
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
    data = await supabaseGet('profiles', { select: profileSelect, id: `eq.${id}`, limit: 1 });
  } else if (type === 'profiles') {
    if (normalizedIds.length === 0) {
      data = [];
    } else {
      data = await supabaseGet('profiles', { select: profileSelect, id: `in.(${normalizedIds.join(',')})`, limit: normalizedIds.length });
    }
  } else {
    const error = new Error('Unsupported type.');
    error.status = 400;
    throw error;
  }

  await cacheSet(cacheKey, data, type === 'profile' ? 300 : type === 'feed' ? 30 : 120).catch(() => {});
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
