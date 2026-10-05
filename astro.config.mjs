// @ts-check
import { defineConfig } from 'astro/config';
import publishingIntegration from './scripts/search-integration.mjs';

const [githubOwner, githubRepository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const githubPagesBuild = Boolean(githubOwner && githubRepository);
const userPagesRepository = githubPagesBuild
  && githubRepository.toLowerCase() === `${githubOwner.toLowerCase()}.github.io`;
const site = process.env.SITE_URL
  || (githubPagesBuild ? `https://${githubOwner}.github.io` : undefined);
const base = process.env.BASE_PATH
  || (githubPagesBuild && !userPagesRepository ? `/${githubRepository}` : '/');

export default defineConfig({
  output: 'static',
  site,
  base,
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
});
