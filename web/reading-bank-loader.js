// The Reading Lab bank is 3.4 MB. Online, app-feature-study.js fetches
// reading-lab-bank.json when practice needs it, so app.html no longer loads it
// on every page. Opened straight from disk (file://) fetch() cannot read it, so
// only then the embedded copy is written in before app-feature-study.js runs.
if (location.protocol === 'file:') {
  document.write('<script src="./web/content/reading-lab-bank.js?v=20261022-reading6"><\/script>');
}
