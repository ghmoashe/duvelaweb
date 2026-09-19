// Receives Content-Security-Policy-Report-Only violation reports (report-uri)
// and writes one compact line per violation to the function log, so a policy
// can be tightened from real traffic before it is enforced.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }
  try {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 16_384) break; // reports are tiny; ignore anything larger
    }
    const body = JSON.parse(raw || '{}');
    const report = body['csp-report'] || body;
    const clip = (value) => String(value == null ? '' : value).slice(0, 200);
    console.log(JSON.stringify({
      type: 'csp-violation',
      directive: clip(report['effective-directive'] || report['violated-directive']),
      blocked: clip(report['blocked-uri'] || report.blockedURL),
      document: clip(report['document-uri'] || report.documentURL),
      source: clip(report['source-file'] || report.sourceFile),
      line: report['line-number'] || report.lineNumber || null,
    }));
  } catch (_) {
    // malformed report: nothing useful to log
  }
  res.statusCode = 204;
  res.end();
};
