// Bundles the Hub's duel engine (decks, rounds, scoring) for the browser so a web
// player gets exactly the same questions and points as the phone on the other side.
// Source: <hub>/shared/duel/duel-engine.ts (sibling checkout "vela academy hub").
// Usage: npm run build:duel-engine [-- <path-to-hub>]
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const hubRoot = path.resolve(process.argv[2] || path.join(root, '..', 'vela academy hub'));
const entry = path.join(hubRoot, 'shared', 'duel', 'duel-engine.ts');
const outfile = path.join(root, 'web', 'duel-engine.generated.js');

if (!fs.existsSync(entry)) {
  console.error('[build-duel-engine] Hub source not found: ' + entry);
  process.exit(1);
}

esbuild
  .build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    globalName: 'DuvelaDuelEngine',
    platform: 'browser',
    target: ['es2018'],
    minify: true,
    legalComments: 'none',
    outfile,
    banner: {
      js: '// GENERATED from vela academy hub/shared/duel/duel-engine.ts by scripts/build-duel-engine.js. Do not edit.',
    },
  })
  .then(() => {
    const size = fs.statSync(outfile).size;
    console.log('[build-duel-engine] wrote ' + path.relative(root, outfile) + ' (' + Math.round(size / 1024) + ' KB)');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
