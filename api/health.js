const { json } = require('./_duvela-public-api');

// Liveness only. It used to run a Redis SET/GET on every call and echo upstream
// error text, which let anyone spend the Upstash quota and read internals.
module.exports = function handler(req, res) {
  return json(res, 200, { ok: true, service: 'duvela-backend-api' }, { 'cache-control': 'no-store' });
};
