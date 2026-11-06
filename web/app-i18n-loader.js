// Loads the app phrase table for the active interface language only
// (web/content/app-phrases/<lang>.js). It must run synchronously after app-i18n.js
// and before the app pages, so the first tr() calls already see the translations.
// English and Russian need no table: tr() has both in the code.
(function () {
  var LANGS = ['ar','az','bg','bs','cs','da','de','es','fa','fi','fr','hr','it','ja','kk','ko','mk','nl','no','pl','pt','ro','sl','sq','sr','sv','tg','tr','uk','uz','vi','zh'];
  try {
    var i18n = window.DuvelaAppI18n && window.DuvelaAppI18n.create({
      localeCatalog: window.DUVELA_WEB_I18N,
      storageKeys: window.DuvelaWebConfig && window.DuvelaWebConfig.storageKeys
    });
    var lang = i18n && i18n.appLang;
    if (LANGS.indexOf(lang) >= 0) document.write('<script src="./web/content/app-phrases/' + lang + '.js?v=20261106-i18n2"><\/script>');
  } catch (error) {
    console.warn('App phrases were not loaded', error);
  }
})();
