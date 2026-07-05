'use strict';

const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const webDir = path.join(root, 'duvela-web');

const services = [
  {
    name: 'Duvela Web',
    port: 5173,
    cwd: webDir,
    command: process.platform === 'win32' ? 'python.exe' : 'python3',
    args: ['-m', 'http.server', '5173', '--bind', '127.0.0.1'],
    env: {},
    url: 'http://127.0.0.1:5173/',
  }
];

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

async function main() {
  const children = [];

  for (const service of services) {
    if (await isPortOpen(service.port)) {
      console.log(`${service.name} already running: ${service.url}`);
      continue;
    }

    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      env: { ...process.env, ...service.env },
      stdio: 'inherit',
      shell: false,
    });
    children.push(child);
    console.log(`Started ${service.name}: ${service.url}`);
  }

  console.log('\nDuvela web URLs:');
  for (const service of services) console.log(`- ${service.name}: ${service.url}`);
  console.log('- Hub Web: http://127.0.0.1:5173/app.html?role=learner#home');
  console.log('- Bus Web: http://127.0.0.1:5173/app.html?role=teacher#home');
  console.log('\nPress Ctrl+C to stop services started by this command.');

  process.on('SIGINT', () => {
    for (const child of children) child.kill('SIGINT');
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
