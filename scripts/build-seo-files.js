const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sandbox = { window: {} };
sandbox.globalThis = sandbox.window;
vm.runInNewContext(
  fs.readFileSync(path.join(root, 'locales/web-locales.js'), 'utf8'),
  sandbox
);
const locales = sandbox.window.DUVELA_WEB_I18N.locales.map(({ code }) => code);
const alternateLinks = [
  '    <xhtml:link rel="alternate" hreflang="x-default" href="https://www.vela.cafe/" />',
  ...locales.map((code) => `    <xhtml:link rel="alternate" hreflang="${code}" href="https://www.vela.cafe/?lang=${code}" />`),
].join('\n');

const publicPages = [
  ['https://www.vela.cafe/business.html', 'monthly', '0.9'],
  ['https://www.vela.cafe/teacher-invite.html', 'monthly', '0.8'],
  ['https://www.vela.cafe/telc-exam.html', 'monthly', '0.7'],
  ['https://www.vela.cafe/telc-a2-exam.html', 'monthly', '0.7'],
  ['https://www.vela.cafe/telc-b1-exam.html', 'monthly', '0.7'],
  ['https://www.vela.cafe/legal.html', 'yearly', '0.3'],
];
const pageXml = publicPages.map(([url, frequency, priority]) => `  <url>\n    <loc>${url}</loc>\n    <changefreq>${frequency}</changefreq>\n    <priority>${priority}</priority>\n  </url>`).join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  `  <url>\n    <loc>https://www.vela.cafe/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n${alternateLinks}\n  </url>\n` +
  `${pageXml}\n</urlset>\n`;
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap, 'utf8');
console.log(`[seo] sitemap includes ${locales.length} homepage locale alternates and ${publicPages.length} public pages`);
