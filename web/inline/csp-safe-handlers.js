// Replaces inline onerror= / onclick= handlers so the site can run under a
// Content-Security-Policy without 'unsafe-inline' scripts.
//   <img data-fallback-src="a.png|b.png">  → tries each source in order on error
//   <img data-flag-code="US">              → swaps the broken flag for a text badge
//   <button data-focus="slotDate">         → focuses #slotDate on click
(function () {
  document.addEventListener('error', function (event) {
    var el = event.target;
    if (!el || el.tagName !== 'IMG') return;
    var chain = el.getAttribute('data-fallback-src');
    if (chain) {
      var list = chain.split('|');
      var index = Number(el.getAttribute('data-fallback-i') || 0);
      if (index < list.length) {
        el.setAttribute('data-fallback-i', String(index + 1));
        el.src = list[index];
      }
      return;
    }
    var code = el.getAttribute('data-flag-code');
    if (code !== null) {
      var badge = document.createElement('span');
      badge.className = 'ob-flag-code';
      badge.textContent = code;
      el.replaceWith(badge);
    }
  }, true);

  document.addEventListener('click', function (event) {
    var trigger = event.target && event.target.closest ? event.target.closest('[data-focus]') : null;
    if (!trigger) return;
    var target = document.getElementById(trigger.getAttribute('data-focus'));
    if (target && target.focus) target.focus();
  });
})();
