# DUVELA Load Test: Feed, Events, Profiles

This test covers read-only public API traffic, not Auth:

- Feed: `posts`, 20 records, pagination
- Events: list, event detail, pagination
- Profiles: author/organizer profile lookup

Use a staging/test Supabase project. The k6 script refuses the current production Supabase URL unless `ALLOW_PRODUCTION_LOAD_TEST=1` is set explicitly.

## Install

Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

## Required Environment

PowerShell:

```powershell
$env:STAGING_SUPABASE_URL="https://your-staging-project.supabase.co"
$env:STAGING_SUPABASE_ANON_KEY="your-staging-anon-key"
```

## Optional Cached Public API

For higher load levels, deploy the read-only cached API and point k6 to it:

```powershell
supabase functions deploy public-read-api --project-ref your-staging-ref
supabase secrets set UPSTASH_REDIS_REST_URL="https://your-upstash-url" UPSTASH_REDIS_REST_TOKEN="your-upstash-token" --project-ref your-staging-ref

$env:STAGING_PUBLIC_API_URL="https://your-staging-project.supabase.co/functions/v1/public-read-api"
```

`public-read-api` supports:

- `type=feed&limit=20&offset=0`
- `type=events&limit=20&offset=0`
- `type=event&id=<event_id>`
- `type=profile&id=<profile_id>`

If Upstash Redis secrets are missing, the function still works but returns `x-duvela-cache: disabled` and reads directly from Supabase.

## Backend API

For production scaling, prefer the DUVELA Backend API instead of calling Supabase directly from the public app.

Local start:

```powershell
$env:SUPABASE_URL="https://your-staging-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
$env:UPSTASH_REDIS_REST_URL="https://your-upstash-url"
$env:UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
npm run backend
```

The backend also reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `.env` for local smoke tests, but production should use `SUPABASE_SERVICE_ROLE_KEY`.

Endpoints:

- `GET /health`
- `GET /metrics`
- `GET /metrics.prom`
- `GET /api/feed?limit=20&offset=0`
- `GET /api/events?limit=20&offset=0`
- `GET /api/events/:id`
- `GET /api/profiles/:id`
- `GET /api/public-read?type=feed|events|event|profile&limit=20&offset=0&id=...`

Point k6 at the backend facade:

```powershell
$env:STAGING_PUBLIC_API_URL="http://127.0.0.1:8787/api/public-read"
npm run load:api:250
```

Staging deploy:

- Use `Dockerfile.backend` for any Docker-capable host.
- Use `render.yaml` if deploying on Render.
- Set the secret env vars from `backend/.env.example`.
- After deploy, set the frontend runtime config before `web/duvela-web-config.js` loads:

```html
<script>
  window.DuvelaRuntimeConfig = {
    publicReadApiUrl: 'https://your-staging-backend.example.com/api/public-read'
  };
</script>
```

Verify a deployed backend:

```powershell
$env:BACKEND_API_URL="https://your-staging-backend.example.com"
npm run backend:check
```

Run load against the deployed backend:

```powershell
$env:BACKEND_API_URL="https://your-staging-backend.example.com"
npm run backend:load:100
npm run backend:load:250
```

Custom level:

```powershell
npm run backend:load -- 500 5m https://your-staging-backend.example.com
```

## Run Load Steps

Each level runs for 5 minutes:

```powershell
npm run load:api:100
npm run load:api:250
npm run load:api:500
npm run load:api:1000
npm run load:api:2000
```

Single custom run:

```powershell
$env:LOAD_TARGET="500"
$env:LOAD_DURATION="5m"
npm run load:api
```

The script retries transient read-only failures (`0`, `408`, `425`, `429`, `5xx`) twice by default. To inspect raw failures without retry:

```powershell
$env:DEBUG_FAILURES="1"
$env:LOAD_RETRIES="0"
npm run load:api
```

When `STAGING_PUBLIC_API_URL` is set, the script prewarms the public cache before the measured VU scenario. Disable that only when intentionally testing cold-cache behavior:

```powershell
$env:PREWARM_CACHE="0"
npm run load:api:250
```

## Success Criteria

- error rate `< 1%`
- p95 latency `< 500 ms`
- no DB connection exhaustion
- CPU/RAM without sustained overload

k6 reports:

- RPS: `http_reqs / test duration`
- p50/p95/p99 latency: `http_req_duration` and endpoint trends
- error rate: `http_req_failed` and `duvela_api_error_rate`
- cache state: `duvela_cache_hits`, `duvela_cache_misses`, `duvela_cache_disabled`, `duvela_cache_errors`
- cache store: `duvela_cache_store_memory`, `duvela_cache_store_redis`

## Supabase Metrics To Watch

During each 5-minute run, watch the staging Supabase dashboard:

- Database connections
- CPU
- RAM
- PostgREST/API latency and errors

For DB-side sampling, run this in SQL editor while the test is active:

```sql
select now() as sampled_at,
       count(*) as total_connections,
       count(*) filter (where state = 'active') as active_connections,
       count(*) filter (where wait_event is not null) as waiting_connections
from pg_stat_activity;
```

Stop the next step if p95 is above 500 ms, error rate reaches 1%, or connections/CPU/RAM stay saturated for more than one minute.
