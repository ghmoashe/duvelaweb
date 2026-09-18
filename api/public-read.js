const { json, metrics, numberParam, readPublicData } = require('./_duvela-public-api');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });

  const started = Date.now();
  try {
    const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
    const type = url.searchParams.get('type') || 'feed';
    const limit = numberParam(url, 'limit', 20, 1, 50);
    const offset = numberParam(url, 'offset', 0, 0, 1000);
    const id = String(url.searchParams.get('id') || '').trim();
    const ids = String(url.searchParams.get('ids') || '').trim();
    const organizerId = String(url.searchParams.get('organizerId') || '').trim();
    if ((type === 'event' || type === 'profile') && !id) return json(res, 400, { error: 'id is required.' });

    const result = await readPublicData(type, { limit, offset, id, ids, organizerId });
    metrics.requests += 1;
    metrics.cache[result.cacheState] = (metrics.cache[result.cacheState] || 0) + 1;
    return json(res, 200, result.data, {
      'cache-control': 'no-store',
      'x-duvela-api': 'vercel-backend',
      'x-duvela-cache': result.cacheState,
      'x-duvela-cache-store': result.cacheStore,
      'x-duvela-duration-ms': String(Date.now() - started),
    });
  } catch (error) {
    metrics.requests += 1;
    metrics.errors += 1;
    return json(res, error.status || 500, { error: error.message || 'Backend API error.' });
  }
};
