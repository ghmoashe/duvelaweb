(function attachDuvelaWebConfig(global) {
  'use strict';

  const config = {
    supabaseUrl: 'https://ohtkryanqcnwghcnipsr.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU',
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
      return global.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    },
  };

  global.DuvelaWebConfig = Object.freeze(config);
})(window);
