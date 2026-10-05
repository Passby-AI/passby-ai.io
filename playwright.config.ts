import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, defineConfig } from '@playwright/test';

function bundledChromium(): string | undefined {
  const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (configured) {
    if (!existsSync(configured)) {
      throw new Error(`PLAYWRIGHT_CHROMIUM_EXECUTABLE does not exist: ${configured}`);
    }
    return configured;
  }

  const expected = chromium.executablePath();
  if (existsSync(expected)) return expected;

  const cacheRoot = process.platform === 'win32'
    ? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'ms-playwright')
    : process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Caches', 'ms-playwright')
      : join(process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'), 'ms-playwright');
  if (!existsSync(cacheRoot)) return undefined;

  const relativeCandidates = process.platform === 'win32'
    ? [join('chrome-win64', 'chrome.exe'), join('chrome-win', 'chrome.exe')]
    : process.platform === 'darwin'
      ? [join('chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'), join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')]
      : [join('chrome-linux64', 'chrome'), join('chrome-linux', 'chrome')];

  const installations = readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((left, right) => Number(right.name.slice(9)) - Number(left.name.slice(9)));

  for (const installation of installations) {
    for (const relative of relativeCandidates) {
      const candidate = join(cacheRoot, installation.name, relative);
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const executablePath = bundledChromium();
if (!executablePath) {
  throw new Error(
    'No Chromium executable was found. Run `pnpm exec playwright install chromium` ' +
    'or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an existing browser binary.',
  );
}

const testPort = Number(process.env.RESPONSIVE_TEST_PORT ?? 4347);

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: 'test-results/responsive',
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    browserName: 'chromium',
    launchOptions: { executablePath },
    screenshot: 'only-on-failure',
  },
});
