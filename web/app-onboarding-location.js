(function () {
  function isIosSafari() {
    var ua = String(navigator.userAgent || navigator.vendor || '').toLowerCase();
    var isAppleTouch = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return isAppleTouch && /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
  }

  function setError(message) {
    var node = document.querySelector('#onboardingError');
    if (node) node.textContent = message || '';
    if (message) window.DuvelaDUVI?.show('locationError', { message: message });
  }

  function setField(selector, value) {
    var input = document.querySelector(selector);
    if (!input || !value) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function locationErrorMessage(error) {
    if (!window.isSecureContext) return 'Location needs HTTPS. Open vela.cafe with https and try again.';
    if (error && error.code === 1) {
      return isIosSafari()
        ? 'Location permission was denied. On iPhone or iPad open Settings > Safari > Location and allow access, then try again. You can also enter the city manually.'
        : 'Location permission was denied. Allow it in the browser, then try again. You can also enter the city manually.';
    }
    if (error && error.code === 2) return 'Location is unavailable right now. Check Wi-Fi or GPS, or enter the city manually.';
    if (error && error.code === 3) return 'Location took too long. Try again near a window or enter the city manually.';
    return 'Could not get your location. You can enter the city manually.';
  }

  async function reverseGeocode(coords) {
    var url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=' +
      encodeURIComponent(coords.latitude) + '&lon=' + encodeURIComponent(coords.longitude) + '&zoom=10';
    var response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Reverse geocoding failed.');
    var json = await response.json();
    var address = json.address || {};
    return {
      city: address.city || address.town || address.village || address.municipality || address.county || '',
      country: address.country || ''
    };
  }

  async function checkPermissionState() {
    if (!navigator.permissions || !navigator.permissions.query) return '';
    try {
      var status = await navigator.permissions.query({ name: 'geolocation' });
      return status && status.state ? status.state : '';
    } catch (error) {
      console.warn('geolocation permissions query skipped', error);
      return '';
    }
  }

  function attach() {
    var input = document.querySelector('#ob-city');
    if (!input || document.querySelector('#ob-location')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'ob-location';
    button.className = 'ob-location';
    button.textContent = 'My location';
    input.parentElement.appendChild(button);

    button.addEventListener('click', async function () {
      setError('');
      if (!navigator.geolocation) {
        button.textContent = 'Not supported';
        setError('This browser does not support location. You can enter the city manually.');
        return;
      }
      if (!window.isSecureContext) {
        setError(locationErrorMessage());
        return;
      }

      var permissionState = await checkPermissionState();
      if (permissionState === 'denied') {
        setError(locationErrorMessage({ code: 1 }));
        return;
      }

      button.disabled = true;
      button.textContent = 'Finding location...';
      navigator.geolocation.getCurrentPosition(async function (position) {
        try {
          var place = await reverseGeocode(position.coords);
          setField('#ob-city', place.city);
          setField('#ob-country', place.country);
          button.textContent = place.city || place.country ? 'Location found' : 'My location';
          if (!place.city && !place.country) setError('Could not detect the city. Please enter it manually.');
        } catch (error) {
          console.warn('location reverse geocode failed', error);
          button.textContent = 'My location';
          setError('Could not find the city. Please enter it manually.');
        } finally {
          button.disabled = false;
        }
      }, function (error) {
        button.disabled = false;
        button.textContent = 'My location';
        setError(locationErrorMessage(error));
      }, {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 20000
      });
    });
  }

  var observer = new MutationObserver(attach);
  observer.observe(document.documentElement, { subtree: true, childList: true });
  attach();
})();
