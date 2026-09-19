const { json, metrics } = require('./_duvela-public-api');

// Served only when METRICS_TOKEN is set and supplied as a Bearer token.
module.exports = function handler(req, res) {
  const expected = process.env.METRICS_TOKEN || '';
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let diff = supplied.length === expected.length ? 0 : 1;
  for (let i = 0; i < Math.min(supplied.length, expected.length); i += 1) {
    diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (!expected || diff !== 0) return json(res, 404, { error: 'Not found.' });
  return json(res, 200, {
    uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
    requests: metrics.requests,
    errors: metrics.errors,
    cache: metrics.cache,
  }, { 'cache-control': 'no-store' });
};
