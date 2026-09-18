#!/usr/bin/env node

const backendUrl = String(process.argv[2] || process.env.BACKEND_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');

async function readJson(path) {
  const response = await fetch(`${backendUrl}${path}`, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }
  return { response, body };
}

function header(response, name) {
  return response.headers.get(name) || '';
}

async function main() {
  console.log(`Checking DUVELA Backend API: ${backendUrl}`);

  const health = await readJson('/health');
  if (!health.response.ok || !health.body?.ok) {
    throw new Error(`Health check failed: ${health.response.status} ${JSON.stringify(health.body)}`);
  }
  console.log(`health ok supabase=${health.body.supabase} redis=${health.body.redis} memoryCache=${health.body.memoryCache}`);

  const feed1 = await readJson('/api/public-read?type=feed&limit=20&offset=0');
  const feed2 = await readJson('/api/public-read?type=feed&limit=20&offset=0');
  if (!feed1.response.ok || !feed2.response.ok) {
    throw new Error(`Feed check failed: ${feed1.response.status}/${feed2.response.status}`);
  }
  console.log(
    `feed ok first=${header(feed1.response, 'x-duvela-cache')}/${header(feed1.response, 'x-duvela-cache-store')} ` +
    `second=${header(feed2.response, 'x-duvela-cache')}/${header(feed2.response, 'x-duvela-cache-store')} ` +
    `rows=${Array.isArray(feed2.body) ? feed2.body.length : 'n/a'}`
  );

  const events1 = await readJson('/api/public-read?type=events&limit=20&offset=0');
  const events2 = await readJson('/api/public-read?type=events&limit=20&offset=0');
  if (!events1.response.ok || !events2.response.ok) {
    throw new Error(`Events check failed: ${events1.response.status}/${events2.response.status}`);
  }
  console.log(
    `events ok first=${header(events1.response, 'x-duvela-cache')}/${header(events1.response, 'x-duvela-cache-store')} ` +
    `second=${header(events2.response, 'x-duvela-cache')}/${header(events2.response, 'x-duvela-cache-store')} ` +
    `rows=${Array.isArray(events2.body) ? events2.body.length : 'n/a'}`
  );

  const metrics = await readJson('/metrics');
  if (!metrics.response.ok) {
    throw new Error(`Metrics check failed: ${metrics.response.status}`);
  }
  console.log(`metrics ok requests=${metrics.body.requests} errors=${metrics.body.errors}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
