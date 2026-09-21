// Receives Content-Security-Policy-Report-Only violation reports (report-uri)
// and writes one compact line per violation to the function log, so a policy
// can be tightened from real traffic before it is enforced.
// Persisted, aggregated copy (public.csp_reports via the anon-callable log_csp_report RPC): Vercel logs expire within
// about an hour, which is far too short to collect real usage before the app/live policy is tightened.
const SUPABASE_URL = 'https://ohtkryanqcnwghcnipsr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU';

async function persist(entry) {
  try {
    await fetch(SUPABASE_URL + '/rest/v1/rpc/log_csp_report', {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_directive: entry.directive, p_blocked: entry.blocked, p_document: entry.document, p_source: entry.source }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (_) {
    // reporting must never break the page or the response
  }
}

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
    const entry = {
      type: 'csp-violation',
      directive: clip(report['effective-directive'] || report['violated-directive']),
      blocked: clip(report['blocked-uri'] || report.blockedURL),
      document: clip(report['document-uri'] || report.documentURL),
      source: clip(report['source-file'] || report.sourceFile),
      line: report['line-number'] || report.lineNumber || null,
    };
    console.log(JSON.stringify(entry));
    await persist(entry);
  } catch (_) {
    // malformed report: nothing useful to log
  }
  res.statusCode = 204;
  res.end();
};
