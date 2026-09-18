#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const target = process.argv[2] || process.env.LOAD_TARGET || '100';
const duration = process.argv[3] || process.env.LOAD_DURATION || '5m';
const backendUrl = String(process.argv[4] || process.env.BACKEND_API_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const publicApiUrl = `${backendUrl}/api/public-read`;
const envFile = path.resolve(process.cwd(), '.env');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, '')];
      })
  );
}

const fileEnv = readEnvFile(envFile);
const env = {
  ...process.env,
  STAGING_SUPABASE_URL: process.env.STAGING_SUPABASE_URL || fileEnv.EXPO_PUBLIC_SUPABASE_URL || '',
  STAGING_SUPABASE_ANON_KEY: process.env.STAGING_SUPABASE_ANON_KEY || fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  STAGING_PUBLIC_API_URL: publicApiUrl,
  ALLOW_PRODUCTION_LOAD_TEST: process.env.ALLOW_PRODUCTION_LOAD_TEST || '1',
};

if (process.platform === 'win32' && !String(env.Path || env.PATH || '').includes('C:\\Program Files\\k6')) {
  env.Path = `${env.Path || env.PATH || ''};C:\\Program Files\\k6`;
}

const outputDir = path.resolve(process.cwd(), 'tests/load/results');
fs.mkdirSync(outputDir, { recursive: true });
const summaryFile = path.join(outputDir, `backend-${target}-${duration.replace(/[^a-z0-9]/gi, '')}.json`);
const k6Binary = process.platform === 'win32' && fs.existsSync('C:\\Program Files\\k6\\k6.exe')
  ? 'C:\\Program Files\\k6\\k6.exe'
  : 'k6';

console.log(`Running k6 against ${publicApiUrl}`);
console.log(`target=${target} duration=${duration} summary=${summaryFile}`);

const result = spawnSync(k6Binary, [
  'run',
  '-e', `LOAD_TARGET=${target}`,
  '-e', `LOAD_DURATION=${duration}`,
  '--summary-export', summaryFile,
  './tests/load/duvela-feed-events-profiles.k6.js',
], {
  stdio: 'inherit',
  shell: false,
  env,
});

process.exitCode = result.status || 0;
