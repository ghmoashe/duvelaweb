'use strict';

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webUrl = process.env.DUVELA_WEB_URL || 'http://127.0.0.1:5173';

function log(message) {
  console.log(`[check:all] ${message}`);
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

function runNodeScript(scriptName, allowSkipExitCode = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, scriptName)], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      if (allowSkipExitCode && code === 2) {
        log(`${scriptName} skipped (exit 2).`);
        return resolve();
      }
      reject(new Error(`${scriptName} failed with exit code ${code}.`));
    });
    child.on('error', reject);
  });
}

async function smokePages() {
  const targets = [
    '/',
    '/index.html',
    '/app.html?role=learner#home',
    '/app.html?role=organizer#workspace',
    '/app.html?role=organization#workspace',
    '/app.html?role=teacher#live',
    '/live.html?app=business&mode=host',
    '/profile.html',
    '/legal.html',
  ];
  for (const target of targets) {
    const response = await fetch(`${webUrl}${target}`);
    if (!response.ok) {
      throw new Error(`Smoke request failed for ${target}: HTTP ${response.status}`);
    }
  }
  log('HTTP smoke pages: OK');
}

async function startServerIfNeeded() {
  if (await isPortOpen(5173)) {
    log(`Using existing web server at ${webUrl}`);
    return null;
  }
  const command = process.platform === 'win32' ? 'python.exe' : 'python3';
  const child = spawn(command, ['-m', 'http.server', '5173', '--bind', '127.0.0.1'], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await isPortOpen(5173)) {
      log(`Started local web server at ${webUrl}`);
      return child;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill('SIGINT');
  throw new Error('Could not start the local web server on 127.0.0.1:5173.');
}

async function main() {
  const server = await startServerIfNeeded();
  try {
    await smokePages();
    await runNodeScript('check-i18n.js');
    await runNodeScript('check-web-backend-e2e.js', true);
    await runNodeScript('agora-browser-e2e.js', true);
    log('All checks completed.');
  } finally {
    if (server) {
      server.kill('SIGINT');
    }
  }
}

main().catch((error) => {
  console.error(`[check:all] ${error.message}`);
  process.exit(1);
});
