(function attachDuvelaRuntimeConfig(global) {
  'use strict';

  global.DuvelaRuntimeConfig = Object.freeze({
    // public_profiles_v2 (017) is live; public-read-api.ts, public-read-service.mjs
    // and /api/public-read (this app's own Vercel function) are all hardened to
    // read it instead of the base profiles table. See
    // docs/security-hardening/PUBLICATION_CONTRACT_017_PRODUCTION_2026-10-15.md
    // in the backend repo.
    securityReadV2: true,
    publicationConsent: true,
    publicationIntake: true,
    // /api/public-read is this app's own Vercel function (api/public-read.js),
    // already updated to read public_profiles_v2 — reuse it instead of pointing
    // at a separate staging URL.
    securityReadV2PublicReadApiUrl: '/api/public-read',
    securityReadV2Release: '20261012-profile-rsvp-v2',
    supabaseUrl: 'https://ohtkryanqcnwghcnipsr.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU',
    // Set this on staging/production after the Backend API is deployed.
    // Example: 'https://duvela-backend-staging.onrender.com/api/public-read'
    publicReadApiUrl: '/api/public-read',
  });
})(window);
