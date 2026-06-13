'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sourceRoot =
  process.env.VELA_LEGAL_SOURCE ??
  path.resolve(root, '..', '..', 'Vela Language Cafe', 'vela-app');
const legalSourcePath = path.join(sourceRoot, 'src', 'LegalPage.tsx');
const consentSourcePath = path.join(sourceRoot, 'src', 'klaro.config.ts');
const typescriptPath = path.join(sourceRoot, 'node_modules', 'typescript');
const outputPath = path.join(root, 'legal', 'legal-content.js');

if (!fs.existsSync(legalSourcePath) || !fs.existsSync(consentSourcePath)) {
  throw new Error(`Legal source project was not found at ${sourceRoot}`);
}

const ts = require(typescriptPath);

function compileAndLoad(source, filename, exportNames) {
  const exportStatement = `\nexport { ${exportNames.join(', ')} };\n`;
  const result = ts.transpileModule(source + exportStatement, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  const module = { exports: {} };
  const sandbox = {
    exports: module.exports,
    module,
    require(id) {
      if (id === 'react/jsx-runtime') {
        return { Fragment: Symbol('Fragment'), jsx() {}, jsxs() {} };
      }
      throw new Error(`Unexpected runtime import while reading ${filename}: ${id}`);
    },
  };

  vm.runInNewContext(result.outputText, sandbox, { filename });
  return module.exports;
}

function replaceBrand(value) {
  if (typeof value === 'string') {
    return value.replace(/\bVela\b/g, 'Duvela');
  }
  if (Array.isArray(value)) return value.map(replaceBrand);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceBrand(item)]),
    );
  }
  return value;
}

const legalExports = compileAndLoad(
  fs.readFileSync(legalSourcePath, 'utf8'),
  legalSourcePath,
  ['PRIVACY_CONTENT', 'IMPRESSUM_CONTENT', 'TERMS_CONTENT'],
);
const consentExports = compileAndLoad(
  fs.readFileSync(consentSourcePath, 'utf8'),
  consentSourcePath,
  ['TRANSLATIONS'],
);

const catalog = {
  version: 1,
  source: 'Vela Language Cafe legal package',
  supportedLocales: Object.keys(legalExports.PRIVACY_CONTENT),
  content: replaceBrand({
    privacy: legalExports.PRIVACY_CONTENT,
    impressum: legalExports.IMPRESSUM_CONTENT,
    terms: legalExports.TERMS_CONTENT,
  }),
  consentTranslations: consentExports.TRANSLATIONS,
  services: [
    { id: 'necessary', title: 'Necessary', purpose: 'necessary', required: true },
    { id: 'ga', title: 'Google Analytics', purpose: 'analytics', required: false },
    { id: 'metaPixel', title: 'Meta Pixel', purpose: 'marketing', required: false },
    { id: 'youtube', title: 'YouTube', purpose: 'external', required: false },
  ],
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `// Generated from Vela Language Cafe. Do not edit by hand.\n` +
    `(function attachDuvelaLegal(global) {\n` +
    `  'use strict';\n` +
    `  global.DUVELA_LEGAL = ${JSON.stringify(catalog, null, 2)};\n` +
    `})(window);\n`,
  'utf8',
);

console.log(
  `Imported ${catalog.supportedLocales.length} legal locales to ${path.relative(root, outputPath)}.`,
);
