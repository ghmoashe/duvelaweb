(function attachDuvelaWebConfig(global) {
  'use strict';

  let cachedClient = null;

  const config = {
    // Bunny Stream CDN hostname used to build video playback / thumbnail
    // URLs from posts.bunny_video_guid. The library id and API key stay
    // server-side; only the public hostname belongs in the client.
    bunnyCdnHostname: 'vz-5ae2a0b6-259.b-cdn.net',
    supabaseUrl: 'https://ohtkryanqcnwghcnipsr.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU',
    publicMarketingDataEnabled: false,
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
        cachedClient = global.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      }
      return cachedClient;
    },
  };

  global.DuvelaWebConfig = Object.freeze(config);
})(window);
