const { json, metrics } = require('./_duvela-public-api');

module.exports = function handler(req, res) {
  return json(res, 200, {
    uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
    requests: metrics.requests,
    errors: metrics.errors,
    cache: metrics.cache,
  }, { 'cache-control': 'no-store' });
};
