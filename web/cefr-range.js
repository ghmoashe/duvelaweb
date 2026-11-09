// The level of a video: one CEFR level or two neighbouring ones, stored as "B1" or "A1-A2".
// Same rules as shared/cefr-level-range.ts in the apps.
(function (global) {
  var LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  function parse(value) {
    var found = String(value || '').toUpperCase().match(/[ABC][12]/g) || [];
    return LEVELS.filter(function (level) { return found.indexOf(level) >= 0; });
  }
  function format(levels) { return levels.length ? levels.join('-') : null; }
  function toggle(value, level) {
    var current = parse(value);
    if (current.indexOf(level) >= 0) return format(current.filter(function (item) { return item !== level; }));
    if (current.length === 1 && Math.abs(LEVELS.indexOf(current[0]) - LEVELS.indexOf(level)) === 1) return format(parse(current[0] + ' ' + level));
    return level;
  }
  // "A1-A2" is shown when a learner filters by A1 or by A2.
  function covers(value, level) {
    var range = parse(value), wanted = parse(level)[0];
    return !!wanted && range.indexOf(wanted) >= 0;
  }
  global.DuvelaCefrRange = { LEVELS: LEVELS, covers: covers, format: format, parse: parse, toggle: toggle };
})(window);
