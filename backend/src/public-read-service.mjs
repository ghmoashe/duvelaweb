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

const PROFILE_SELECT = [
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
      const error = new Error('id is required.');
      error.status = 400;
      throw error;
    }
    const normalizedIds = idListParam(ids);

    const cacheKey = ['backend-api:v2', type, limit, offset, id, normalizedIds.join(','), organizerId].join(':');
    let cacheState = 'disabled';
    try {
      const cached = await this.cache.get(cacheKey);
      cacheState = cached.state;
      if (cached.value) return { data: cached.value, cacheState: 'hit', cacheStore: cached.store || 'cache' };
    } catch (_) {
      cacheState = 'error';
    }

    const data = await this.fetchSource(type, { limit, offset, id, ids: normalizedIds, organizerId });

    try {
      await this.cache.set(cacheKey, data, this.ttl[type] || 30);
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
      const rows = await this.supabase.get('profiles', {
        select: PROFILE_SELECT,
        id: `eq.${id}`,
        limit: 1,
      });
      return Array.isArray(rows) ? rows : [];
    }

    if (!ids.length) return [];

    const rows = await this.supabase.get('profiles', {
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
    .slice(0, 50);
}
