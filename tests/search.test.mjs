import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNavigation } from '../src/lib/navigation-model.ts';
import { canonicalSearchResult } from '../src/lib/search.ts';
import { searchRoute, assertPageRoute } from '../src/lib/routes.ts';
import { executeCommand } from '../src/lib/terminal/executor.ts';

test('GUI and terminal search use the same base-aware URL and preserve query characters', () => {
  for (const base of ['/', '/terminal_blog/']) {
    const root = buildNavigation([], [], base);
    const result = executeCommand('search "中文 & C++"', { root, state: { cwd: '~', history: [] }, theme: 'system' });
    assert.equal(result.navigate, searchRoute('中文 & C++', base));
    assert.equal(new URL(result.navigate, 'https://example.test').searchParams.get('q'), '中文 & C++');
    assert.equal(result.state.cwd, '~');
  }
  assert.throws(() => assertPageRoute('search', 'note.md'), /reserved route/);
});

test('search results resolve through the shared published navigation model', () => {
  const root = buildNavigation([{ data: { slug: '中文', title: 'Canonical title' } }], [], '/blog/');
  const hit = { url: '/blog/posts/中文/', meta: { title: 'Index title' }, excerpt: 'Matching text' };
  assert.deepEqual(canonicalSearchResult(hit, root), { route: '/blog/posts/%E4%B8%AD%E6%96%87/', title: 'Canonical title', excerpt: 'Matching text' });
  for (const url of ['/posts/中文/', '/blog/', '/blog/posts/draft/']) assert.equal(canonicalSearchResult({ ...hit, url }, root), undefined);
});
