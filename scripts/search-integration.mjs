import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as pagefind from 'pagefind';
import { satteri } from '@astrojs/markdown-satteri';
import publishedUrls from './published-urls.mjs';

export default function publishingIntegration() {
  return {
    name: 'blog-publishing',
    hooks: {
      'astro:config:setup': ({ config, updateConfig }) => {
        updateConfig({ markdown: { processor: satteri({ mdastPlugins: [publishedUrls({ base: config.base })] }) } });
      },
      'astro:build:done': async ({ dir, logger }) => {
        const checked = (result) => {
          if (result.errors?.length) throw new Error(`Pagefind: ${result.errors.join('; ')}`);
          return result;
        };
        try {
          const { index } = checked(await pagefind.createIndex());
          if (!index) throw new Error('Pagefind did not create an index');
          const result = checked(await index.addDirectory({ path: fileURLToPath(dir) }));
          checked(await index.writeFiles({ outputPath: path.join(fileURLToPath(dir), 'pagefind') }));
          logger.info(`Pagefind scanned ${result.page_count} pages; only marked articles enter the index.`);
        } finally { await pagefind.close(); }
      },
    },
  };
}
