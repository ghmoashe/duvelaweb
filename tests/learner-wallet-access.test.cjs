const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('learner routes cannot resolve the business earnings panel', () => {
  const router = read('web/app-router.js');
  const page = read('web/app-page.js');
  const hubTitles = page.slice(page.indexOf('hub: {', page.indexOf('const titles')), page.indexOf('bus: {', page.indexOf('const titles')));

  assert.match(router, /learnerView === 'management' \|\| learnerView === 'earnings'/);
  assert.match(router, /mode !== 'bus' && businessOnly \? defaultView/);
  assert.match(router, /mode === 'bus' && learnerOnly \? defaultView : learnerView/);
  assert.doesNotMatch(hubTitles, /earnings:/);
});

test('learner settings open the dedicated Duvela Wallet', () => {
  const html = read('app.html');
  const page = read('web/app-page.js');

  assert.match(html, /data-settings-action="wallet"><span data-wallet-settings-label>Duvela Wallet/);
  assert.match(html, /data-panel="wallet"><div id="learnerWalletView"/);
  assert.match(page, /setView\('wallet'\);[\s\S]*?await loadWallet\(\)/);
  assert.match(page, /renderLearnerWallet/);
});

test('earnings rendering is guarded before financial queries execute', () => {
  const html = read('app.html');
  const page = read('web/app-page.js');
  const dashboard = read('web/app-feature-dashboard.js');

  assert.match(html, /class="panel bus-only" data-panel="earnings"/);
  assert.match(page, /function renderEarnings\(\)[\s\S]*?if \(!isBusiness\(\)\)[\s\S]*?host\.replaceChildren\(\)/);
  assert.match(dashboard, /if \(!ctx\.isBusiness\(\)\) \{ host\.replaceChildren\(\); return; \}/);
});

test('Business retains its Earnings and Finance workspace', () => {
  const page = read('web/app-page.js');
  const busTitles = page.slice(page.indexOf('bus: {', page.indexOf('const titles')));
  assert.match(busTitles, /earnings: \[tr\('Earnings & Finance'/);
  assert.match(read('app.html'), /app-feature-dashboard\.js\?v=20261021-learner-wallet1/);
  assert.match(read('app.html'), /app-page\.js\?v=20261026-teacher-rooms-web/);
});

test('student wallet uses server balance and coin activity without inventing web checkout', () => {
  const feature = read('web/app-feature-gamification.js');
  assert.match(feature, /supa\.rpc\('get_my_coin_balance'\)/);
  assert.match(feature, /from\('coin_transactions'\)/);
  assert.match(feature, /Web checkout for DC is not connected yet/);
  assert.match(feature, /data-wallet-live/);
});
