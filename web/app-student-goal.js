(function () {
  var LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  function normalize(value, fallback) {
    var raw = String(value || '').trim().toUpperCase();
    return LEVELS.indexOf(raw) >= 0 ? raw : (fallback || '');
  }

  function fromProfile(profile, fallback) {
    return normalize(profile && profile.goal_level, fallback);
  }

  function legacyPatch(level) {
    var value = normalize(level, 'A1');
    return { goal_level: value, learning_goal: value };
  }

  window.DuvelaStudentGoal = {
    LEVELS: LEVELS.slice(),
    normalize: normalize,
    fromProfile: fromProfile,
    legacyPatch: legacyPatch
  };
})();
