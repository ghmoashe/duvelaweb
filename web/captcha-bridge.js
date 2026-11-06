// captcha.html runs inside the Hub and Business apps: the Turnstile token goes back
// to the app, which repeats the sign-in with it (shared/auth-captcha-host.tsx).
window.duvelaCaptchaDone = function (token) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({ token: token }));
};
