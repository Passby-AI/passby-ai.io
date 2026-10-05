import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = Number(process.env.RESPONSIVE_TEST_PORT ?? 4347);
const address = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ['scripts/serve-dist.mjs', '--port', String(port)], {
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Static preview exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(address);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Static preview did not become ready at ${address}.`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  const stopped = new Promise((resolve) => server.once('exit', resolve));
  server.kill();
  await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 2_000))]);
}

let exitCode = 1;
try {
  await waitForServer();
  const cli = fileURLToPath(import.meta.resolve('@playwright/test/cli'));
  const runner = spawn(process.execPath, [cli, 'test', '--config=playwright.config.ts', ...process.argv.slice(2)], {
    env: { ...process.env, RESPONSIVE_TEST_PORT: String(port) },
    stdio: 'inherit',
    windowsHide: true,
  });
  exitCode = await new Promise((resolve, reject) => {
    runner.once('error', reject);
    runner.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await stopServer();
}

process.exitCode = exitCode;
