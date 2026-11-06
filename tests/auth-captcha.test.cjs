const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function load() {
  const box = { window: {} };
  vm.createContext(box);
  vm.runInContext(read('web/auth-captcha.js'), box);
  return box.window.DuvelaAuthCaptcha;
}

test('sign-in goes out without a token and shows nothing while captcha is off', async () => {
  const tokens = [];
  const result = await load().withCaptcha(async (token) => { tokens.push(token); return { error: null, data: 1 }; });
  assert.equal(result.data, 1);
  assert.deepEqual(tokens, [undefined]);
});

test('captcha refusals are told apart from wrong passwords', () => {
  const { isCaptchaError } = load();
  assert.equal(isCaptchaError({ code: 'captcha_failed' }), true);
  assert.equal(isCaptchaError({ message: 'captcha protection: request disallowed' }), true);
  assert.equal(isCaptchaError({ message: 'Invalid login credentials' }), false);
  assert.equal(isCaptchaError(null), false);
});

test('the check page reports to the app and ships with the site', () => {
  const page = read('captcha.html');
  assert.ok(page.indexOf('captcha-bridge.js') < page.indexOf('turnstile/v0/api.js'), 'the callback must exist first');
  assert.match(page, /data-callback="duvelaCaptchaDone"/);
  assert.match(read('web/captcha-bridge.js'), /ReactNativeWebView\.postMessage/);
  assert.match(read('scripts/build-static-site.js'), /'captcha\.html'/);
});

test('the auth script waits for the captcha helper', () => {
  const pageScript = read('web/index-page.js');
  assert.ok(pageScript.indexOf('auth-captcha.js') < pageScript.indexOf('index-auth.js'));
});
