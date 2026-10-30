// Loads the LIVE studio/viewer phrase table for the active interface language only
// (web/content/live-phrases/<lang>.js). It must run synchronously before
// live-page.js so the first tr() calls already see the translations.
(function () {
  var LANGS = ['pt','it','no','de','fr','nl','sv','es','da','fi','bg','sq','hr','bs','mk','ro','sl','sr','pl','cs','tr','uk','kk','az','uz','fa','tg','ar','vi','zh','ja','ko'];
  try {
    var i18n = window.DuvelaAppI18n && window.DuvelaAppI18n.create({
      localeCatalog: window.DUVELA_WEB_I18N,
      storageKeys: window.DuvelaWebConfig && window.DuvelaWebConfig.storageKeys
    });
    var lang = i18n && i18n.appLang;
    if (LANGS.indexOf(lang) >= 0) document.write('<script src="./web/content/live-phrases/' + lang + '.js?v=20261030-live-i18n"><\/script>');
  } catch (error) {
    console.warn('LIVE phrases were not loaded', error);
  }
})();
