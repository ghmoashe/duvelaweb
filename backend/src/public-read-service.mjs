const FEED_SELECT = [
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

const EVENT_SELECT = [
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
// This service runs with the Supabase service key (RLS bypassed), so the
// only thing standing between a profile's private fields and any
// unauthenticated caller is reading from public_profiles_v2 instead of
// profiles: that view already encodes the owner's reviewed publication
// consent and their approved-field selection. Clients read their OWN
// profile straight from Supabase with the user's session instead.
const PROFILE_SELECT = [
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

export function numberParam(url, name, fallback, min, max) {
  const value = Number(url.searchParams.get(name) || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export class PublicReadService {
  constructor({ supabase, cache, ttl }) {
    this.supabase = supabase;
    this.cache = cache;
    this.ttl = ttl;
  }

  async read(type, { limit = 20, offset = 0, id = '', ids = '', organizerId = '' }) {
    if (!['feed', 'events', 'event', 'profile', 'profiles'].includes(type)) {
      const error = new Error('Unsupported type.');
      error.status = 400;
      throw error;
    }
    if ((type === 'event' || type === 'profile') && !id) {
      throw badRequest('id is required.');
    }
    // Only well-formed UUIDs reach the query string or the cache key: keeps
    // PostgREST filter syntax out of user input and stops an attacker from
    // minting unlimited unique cache keys.
    if (id && !UUID_RE.test(id)) throw badRequest('Invalid id.');
    if (organizerId && !UUID_RE.test(organizerId)) throw badRequest('Invalid organizerId.');
    const normalizedIds = idListParam(ids);
    if (normalizedIds.some((item) => !UUID_RE.test(item))) throw badRequest('Invalid ids.');

    const cacheKey = ['backend-api:v3', type, limit, offset, id, normalizedIds.join(','), organizerId].join(':');
    let cacheState = 'disabled';
    try {
      // Profile responses are never cached: the owner's reviewed publication
      // choice can be revoked at any time, and a shared cache would keep
      // serving a withdrawn projection to later callers.
      const cached = ['profile', 'profiles'].includes(type) ? { state: 'disabled' } : await this.cache.get(cacheKey);
      cacheState = cached.state;
      if (!['profile', 'profiles'].includes(type) && cached.value) return { data: cached.value, cacheState: 'hit', cacheStore: cached.store || 'cache' };
    } catch (_) {
      cacheState = 'error';
    }

    const data = await this.fetchSource(type, { limit, offset, id, ids: normalizedIds, organizerId });

    try {
      if (!['profile', 'profiles'].includes(type)) await this.cache.set(cacheKey, data, this.ttl[type] || 30);
    } catch (_) {
      if (cacheState !== 'disabled') cacheState = 'error';
    }

    return { data, cacheState, cacheStore: this.cache.enabled ? 'redis' : 'memory' };
  }

  async fetchSource(type, { limit, offset, id, ids, organizerId }) {
    if (type === 'feed') {
      return this.supabase.get('posts', {
        select: FEED_SELECT,
        media_type: 'in.(video,youtube,image)',
        media_url: 'not.is.null',
        // Service key bypasses RLS: hide what RLS hides from users.
        shorts_deleted_at: 'is.null',
        or: '(shorts_hidden.is.null,shorts_hidden.eq.false)',
        shorts_visibility: 'eq.public',
        order: 'created_at.desc',
        limit,
        offset,
      });
    }

    if (type === 'events') {
      return this.supabase.get('events', {
        select: EVENT_SELECT,
        organizer_id: organizerId ? `eq.${organizerId}` : undefined,
        order: organizerId ? 'event_date.desc' : 'event_date.asc',
        limit,
        offset,
      });
    }

    if (type === 'event') {
      const rows = await this.supabase.get('events', {
        select: EVENT_SELECT,
        id: `eq.${id}`,
        limit: 1,
      });
      return Array.isArray(rows) ? rows : [];
    }

    if (type === 'profile') {
      const rows = await this.supabase.get('public_profiles_v2', {
        select: PROFILE_SELECT,
        id: `eq.${id}`,
        limit: 1,
      });
      return Array.isArray(rows) ? rows : [];
    }

    if (!ids.length) return [];

    const rows = await this.supabase.get('public_profiles_v2', {
      select: PROFILE_SELECT,
      id: `in.(${ids.join(',')})`,
      limit: ids.length,
    });
    return Array.isArray(rows) ? rows : [];
  }
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
