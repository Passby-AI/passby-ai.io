// @ts-check
import { defineConfig } from 'astro/config';
import publishingIntegration from './scripts/search-integration.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  integrations: [publishingIntegration()],
  // Keep Unicode-range font files external so the browser can load them lazily.
  vite: { build: { assetsInlineLimit: 0 } },
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
  // Configure site and base in T22 once the GitHub Pages destination is known.
});
