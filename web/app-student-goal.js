(function () {
  var LEVELS = ['A2', 'B1', 'B2', 'C1'];

  function normalize(value, fallback) {
    var raw = String(value || '').trim().toUpperCase();
    var safeFallback = String(fallback || '').trim().toUpperCase();
    if (LEVELS.indexOf(raw) >= 0) return raw;
    if (LEVELS.indexOf(safeFallback) >= 0) return safeFallback;
    return 'A2';
  }

  function fromProfile(profile, fallback) {
    return normalize(profile && profile.goal_level, fallback);
  }

  function legacyPatch(level) {
    var value = normalize(level, 'A2');
    return { goal_level: value, learning_goal: value };
  }

  window.DuvelaStudentGoal = {
    LEVELS: LEVELS.slice(),
    normalize: normalize,
    fromProfile: fromProfile,
    legacyPatch: legacyPatch
  };
})();
