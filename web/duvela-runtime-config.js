(function attachDuvelaRuntimeConfig(global) {
  'use strict';

  global.DuvelaRuntimeConfig = Object.freeze({
    // Set this on staging/production after the Backend API is deployed.
    // Example: 'https://duvela-backend-staging.onrender.com/api/public-read'
    publicReadApiUrl: '/api/public-read',
  });
})(window);
