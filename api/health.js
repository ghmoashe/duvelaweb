const { config, json, metrics, redisSelfTest } = require('./_duvela-public-api');

module.exports = async function handler(req, res) {
  const cfg = config();
  let redisTest = null;
  if (cfg.redisRestUrl && cfg.redisRestToken) {
    try {
      redisTest = await redisSelfTest();
    } catch (error) {
      redisTest = { configured: true, ok: false, error: error?.message || String(error) };
    }
  }

  return json(res, 200, {
    ok: true,
    service: 'duvela-backend-api',
    runtime: 'vercel',
    supabase: cfg.supabaseUrl && cfg.supabaseKey ? 'configured' : 'missing',
    redis: cfg.redisRestUrl && cfg.redisRestToken ? 'configured' : 'disabled',
    redisTest,
    lastCacheSetError: metrics.lastCacheSetError,
    memoryCache: 'enabled',
  }, { 'cache-control': 'no-store' });
};
