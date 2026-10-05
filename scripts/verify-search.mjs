import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalSearchResult } from '../src/lib/search.ts';

// Execute the actual generated Pagefind JS/WASM against files, without simulating a browser UI.
const root = resolve(process.argv[2] ?? 'dist');
const base = process.argv[3] ?? '/';
const query = process.argv[4] ?? 'vector3f';
const expected = process.argv[5] ?? '从实现一个vector3f向量类-深入了解运算符重载';
const html = await readFile(join(root, 'index.html'), 'utf8');
const navigation = JSON.parse(/<script\b(?=[^>]*id="blog-navigation")[^>]*>([\s\S]*?)<\/script>/.exec(html)[1]);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = new URL(String(input), 'https://blog.invalid');
  const marker = url.pathname.lastIndexOf('/pagefind/');
  assert.ok(marker >= 0, `Unexpected search resource: ${url}`);
  const file = resolve(root, decodeURIComponent(url.pathname.slice(marker + 1)));
  assert.ok(file.startsWith(root + sep), 'Search resource escaped build directory');
  return new Response(await readFile(file));
};
try {
  const pagefind = await import(pathToFileURL(join(root, 'pagefind/pagefind.js')).href);
  await pagefind.options({ baseUrl: base });
  const response = await pagefind.search(query);
  const hits = await Promise.all(response.results.map((result) => result.data()));
  assert.ok(hits.length > 0, `No search results for ${query}`);
  const canonical = hits.map((hit) => canonicalSearchResult(hit, navigation));
  assert.ok(canonical.every(Boolean), 'Search index contains destinations outside the published navigation tree');
  assert.ok(canonical.some((result) => decodeURI(result.route).includes(`/posts/${expected}/`)), `Missing expected destination ${expected}`);
  assert.ok(hits.every((hit) => hit.url.startsWith(base)), 'Pagefind result escaped deployment base');
  const noMatchQuery = 'zzz-no-matching-content-928461';
  const none = await pagefind.search(noMatchQuery);
  const normalizedQuery = noMatchQuery.toLocaleLowerCase();
  const noMatchHits = await Promise.all(none.results.map((result) => result.data()));
  assert.ok(noMatchHits.every((hit) => {
    const searchable = [
      hit.content,
      hit.raw_content,
      hit.excerpt,
      hit.plain_excerpt,
      hit.meta?.title,
    ].filter((value) => typeof value === 'string').join('\n').toLocaleLowerCase();
    return !searchable.includes(normalizedQuery);
  }), 'No-match query appears as an exact phrase in a Pagefind result');
  console.log(`Verified Pagefind JS/WASM search: ${query}, ${hits.length} canonical results at ${base}`);
} finally { globalThis.fetch = originalFetch; }
