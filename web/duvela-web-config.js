(function attachDuvelaWebConfig(global) {
  'use strict';

  let cachedClient = null;

  const runtimeConfig = global.DuvelaRuntimeConfig || {};
  const localBackendApiUrl = ['127.0.0.1', 'localhost'].includes(global.location.hostname)
    ? 'http://127.0.0.1:8787/api/public-read'
    : '';

  const config = {
    // Rollout switch only. Server-side grants/RLS remain the security boundary.
    securityReadV2: runtimeConfig.securityReadV2 === true,
    // Bunny Stream CDN hostname used to build video playback / thumbnail
    // URLs from posts.bunny_video_guid. The library id and API key stay
    // server-side; only the public hostname belongs in the client.
    bunnyCdnHostname: 'vz-5ae2a0b6-259.b-cdn.net',
    supabaseUrl: runtimeConfig.supabaseUrl || 'https://ohtkryanqcnwghcnipsr.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU',
    // Optional deployment-provided HTTPS origin for student invitations.
    // Empty on local development so localhost can never leak into a QR code.
    publicAppUrl: String(runtimeConfig.publicAppUrl || '').replace(/\/+$/, ''),
    publicReadApiUrl: String(runtimeConfig.securityReadV2 === true
      ? (runtimeConfig.securityReadV2PublicReadApiUrl || '')
      : (runtimeConfig.publicReadApiUrl || localBackendApiUrl || '')).replace(/\/+$/, ''),
    publicMarketingDataEnabled: false,
    publicProfileFieldsV2: 'id,full_name,avatar_url,cover_url,city,country,bio,language,language_level,teaches_languages,explanation_languages,qualifications,specialization,teaching_experience,teacher_audience,is_teacher,is_organizer,is_verified,score,instagram,tiktok,youtube,facebook,linkedin,website,registered_web_role',
    publicProfiles(client, legacyFields, options) {
      return client.from(config.securityReadV2 ? 'public_profiles_v2' : 'profiles')
        .select(config.securityReadV2 ? config.publicProfileFieldsV2 : legacyFields, options);
    },
    rankingProfiles(client, legacyFields) {
      const query = config.publicProfiles(client, legacyFields);
      return config.securityReadV2 ? query.not('score', 'is', null) : query;
    },
    async relatedProfiles(client, ids, legacyFields) {
      if (!config.securityReadV2) return client.from('profiles').select(legacyFields).in('id', ids);
      const data = [];
      const unique = [...new Set(ids.filter(Boolean))];
      for (let offset = 0; offset < unique.length; offset += 100) {
        const result = await client.rpc('related_profile_identities_v2', { profile_ids: unique.slice(offset, offset + 100) });
        if (result.error) return { data: null, error: result.error };
        data.push(...(result.data || []));
      }
      return { data, error: null };
    },
    async eventGoingCounts(client, ids) {
      const counts = {};
      const unique = [...new Set(ids.filter(Boolean))];
      for (let offset = 0; offset < unique.length; offset += 100) {
        const chunk = unique.slice(offset, offset + 100);
        const result = await client.rpc('event_going_counts_v2', { event_ids: chunk });
        if (result.error) throw result.error;
        chunk.forEach(id => { counts[id] = 0; });
        (result.data || []).forEach(row => {
          const count = Number(row.going_count);
          if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid event count.');
          counts[row.event_id] = count;
        });
      }
      return counts;
    },
    async eventCount(client, id) {
      const counts = await config.eventGoingCounts(client, [id]);
      return { count: counts[id] || 0, error: null };
    },
    storageKeys: {
      role: 'duvela.webRole',
      lang: 'duvela.webLang',
      signupRole: 'duvela.webSignupRole',
      authFlow: 'duvela.webAuthInProgress',
      authMode: 'duvela.webAuthMode',
    },
    createSupabaseClient() {
      if (!global.supabase || typeof global.supabase.createClient !== 'function') {
        throw new Error('Supabase client library failed to load.');
      }
      // Reuse one client per page. Several page scripts call this, and creating a
      // fresh client each time spins up multiple GoTrueClient auth instances that
      // share the same storage key — Supabase warns this can behave unpredictably.
      if (!cachedClient) {
        if (config.securityReadV2 && (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey)) {
          throw new Error('Security v2 review requires an explicit staging Supabase URL and anon key.');
        }
        if (config.securityReadV2 && config.supabaseUrl.replace(/\/+$/, '') === 'https://ohtkryanqcnwghcnipsr.supabase.co'
            && runtimeConfig.securityReadV2Release !== '20261012-profile-rsvp-v2') {
          throw new Error('Production security v2 requires a reviewed release configuration.');
        }
        cachedClient = global.supabase.createClient(config.supabaseUrl, runtimeConfig.supabaseAnonKey || config.supabaseAnonKey);
      }
      return cachedClient;
    },
  };

  global.DuvelaWebConfig = Object.freeze(config);
})(window);
