// Turnstile for sign-in, sign-up and password reset on the website. The request goes out
// without a token first: while captcha is off in Supabase nobody sees anything, and once
// it is on the server's refusal opens the check and the request is repeated.
(function (global) {
  var SITE_KEY = '0x4AAAAAAF2CiDAGozqMfvt-';
  var SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

  function isCaptchaError(error) {
    if (!error) return false;
    return error.code === 'captcha_failed' || /captcha/i.test(String(error.message || ''));
  }

  function loadTurnstile() {
    if (global.turnstile) return Promise.resolve(global.turnstile);
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = SCRIPT;
      script.onload = function () { resolve(global.turnstile); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function askForToken() {
    return loadTurnstile().then(function (turnstile) {
      return new Promise(function (resolve) {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,12,38,.55)';
        var box = document.createElement('div');
        box.style.cssText = 'position:relative;padding:40px 16px 16px;border-radius:16px;background:#fff';
        var close = document.createElement('button');
        close.type = 'button';
        close.textContent = '×';
        close.setAttribute('aria-label', 'Close');
        close.style.cssText = 'position:absolute;top:4px;right:6px;width:36px;height:36px;border:0;background:none;font-size:24px;cursor:pointer;color:#4a4258';
        var slot = document.createElement('div');
        box.appendChild(close);
        box.appendChild(slot);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        function finish(token) { overlay.remove(); resolve(token || ''); }
        close.onclick = function () { finish(''); };
        turnstile.render(slot, { sitekey: SITE_KEY, callback: finish });
      });
    }).catch(function () { return ''; });
  }

  // run(captchaToken) performs the request and returns { data, error }.
  async function withCaptcha(run) {
    var first = await run();
    if (!isCaptchaError(first.error)) return first;
    var token = await askForToken();
    return token ? run(token) : first;
  }

  global.DuvelaAuthCaptcha = { isCaptchaError: isCaptchaError, withCaptcha: withCaptcha };
})(window);
