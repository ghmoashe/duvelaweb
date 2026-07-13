# Duvela Web

Static browser surfaces for Duvela:

- `index.html`: marketing and auth entry
- `app.html`: main authenticated web app
- `live.html`: browser LIVE host and viewer
- `profile.html`: public teacher, organizer, and organization profiles

## Local run

Start a static server from the repo root:

```bash
python -m http.server 5173 --bind 127.0.0.1
```

Open `http://127.0.0.1:5173/index.html`.

## Checks

Run:

```bash
npm run check
```

This executes:

- smoke requests for key routes
- local web contract checks for role requests and LIVE backend wiring
- publish readiness checks for headers, asset budgets and large local media warnings
- locale catalog validation
- backend E2E checks when test credentials are present
- browser Agora E2E when test credentials are present

Optional environment variables for authenticated checks:

- `DUVELA_TEST_TEACHER_EMAIL`
- `DUVELA_TEST_TEACHER_PASSWORD`
- `DUVELA_TEST_LEARNER_EMAIL`
- `DUVELA_TEST_LEARNER_PASSWORD`
- `DUVELA_WEB_URL`
- `DUVELA_HEADLESS`

Run only the local contract checks with:

```bash
npm run check:contracts
```

Run only the publish readiness checks with:

```bash
npm run check:publish
```

Set `DUVELA_STRICT_PUBLISH=1` to fail the publish check when large local media files such as `Duvela.mp4` are still present in the deploy tree. The landing video is loaded from Supabase Storage and uses `preload="none"`; do not deploy the local 80 MB MP4 with the static site.

With teacher and learner credentials present, `npm run check:backend` also verifies LIVE session create/update, learner room read, participant join, chat insert, free gift payment, restream status, and Agora publisher/subscriber token generation.

## Publish checklist

Before publishing Web/Hub/Business/LIVE:

- Apply `scripts/duvela-web-supabase.sql` and `scripts/web-role-requests.sql` in Supabase.
- Deploy Edge Functions: `agora-token`, `notify-course-enrollment`, `live-payment`, `live-restream`.
- Run `npm run check`; for release hardening run `DUVELA_STRICT_PUBLISH=1 npm run check:publish` from a deploy folder that excludes local videos.
- Publish static files with `_headers` so HTML revalidates while images and shared assets get cache headers.
- Verify production URLs for `index.html`, `app.html`, `live.html`, `profile.html`, and `legal.html`.

## Supabase backend

Apply `scripts/duvela-web-supabase.sql` in the Supabase SQL editor before using Web/Hub/Business/LIVE end to end.

LIVE also expects these Edge Functions to be deployed:

- `agora-token`: creates Agora publisher/subscriber tokens
- `notify-course-enrollment`: handles course enrollment notifications
- `live-payment`: validates gifts, charges `profiles.vela_coin_balance`, and writes `live_gifts`
- `live-restream`: currently a safe restream status/stub endpoint; real RTMP restream still needs provider integration and secrets

Function source for the LIVE additions lives under `supabase/functions/`.

## Shared runtime

Reusable browser code lives under `web/`:

- `duvela-web-config.js`: Supabase config and storage keys
- `duvela-web-roles.js`: shared role normalization and auto-detection
- `duvela-web-ui.js`: toast-based feedback helpers

The next structural step is moving the remaining large inline scripts from `index.html` and `app.html` into feature files under `web/`.
