import { withBase } from '../src/lib/routes.ts';

/** Resolve adapter URLs at build time, so synced Markdown is deployment-independent. */
export default function publishedUrls({ base = '/' } = {}) {
  function rewrite(node, context) {
    if (node.url.startsWith('blog:/')) context.setProperty(node, 'url', withBase(node.url.slice(6), base));
  }
  return { name: 'published-urls', link: rewrite, image: rewrite, definition: rewrite };
}
