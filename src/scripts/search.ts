import type { NavigationNode } from '../lib/navigation-model';
import { canonicalSearchResult, type SearchHit } from '../lib/search';

interface PagefindResult { data(): Promise<SearchHit> }
interface Pagefind { options(options: { baseUrl: string }): Promise<void>; search(query: string): Promise<{ results: PagefindResult[] }> }
const form = document.querySelector<HTMLFormElement>('[data-search-form]')!;
const input = document.querySelector<HTMLInputElement>('#search-query')!;
const status = document.querySelector<HTMLElement>('[data-search-status]')!;
const results = document.querySelector<HTMLOListElement>('[data-search-results]')!;
const more = document.querySelector<HTMLButtonElement>('[data-search-more]')!;
const root: NavigationNode = JSON.parse(document.querySelector('#blog-navigation')!.textContent!);
let modulePromise: Promise<Pagefind> | undefined;
let generation = 0;
let hits: PagefindResult[] = [];
let offset = 0;

async function loadMore(request: number) {
  more.disabled = true;
  const batch = await Promise.all(hits.slice(offset, offset + 20).map((hit) => hit.data()));
  if (request !== generation) return;
  offset += batch.length;
  for (const hit of batch) {
    const result = canonicalSearchResult(hit, root);
    if (!result) continue;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = result.route;
    link.textContent = result.title;
    const excerpt = document.createElement('p');
    // Pagefind returns highlighted HTML. Extract text without inserting HTML into the page.
    excerpt.textContent = new DOMParser().parseFromString(result.excerpt, 'text/html').body.textContent;
    item.append(link, excerpt);
    results.append(item);
  }
  more.hidden = offset >= hits.length;
  more.disabled = false;
}

async function search() {
  const request = ++generation;
  const query = input.value.trim();
  results.replaceChildren();
  more.hidden = true;
  hits = [];
  offset = 0;
  if (!query) { status.textContent = '输入关键词搜索已发布内容。'; return; }
  status.textContent = '正在搜索…';
  try {
    modulePromise ??= import(/* @vite-ignore */ form.dataset.pagefindUrl!).then(async (module: Pagefind) => {
      await module.options({ baseUrl: root.route! });
      return module;
    });
    const pagefind = await modulePromise;
    const response = await pagefind.search(query);
    if (request !== generation) return;
    hits = response.results;
    await loadMore(request);
    if (request === generation) status.textContent = hits.length ? `找到 ${hits.length} 条结果。` : '没有找到匹配内容，请尝试其他关键词。';
  } catch {
    if (request !== generation) return;
    modulePromise = undefined;
    more.hidden = true;
    status.textContent = import.meta.env.DEV
      ? '开发模式尚无搜索索引。请运行 pnpm build 和 pnpm preview 后验证搜索。'
      : '搜索索引加载失败，请重试或通过侧栏浏览文章。';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const url = new URL(form.action);
  if (input.value.trim()) url.searchParams.set('q', input.value.trim());
  window.history.pushState(null, '', url);
  void search();
});
more.addEventListener('click', () => {
  const request = generation;
  void loadMore(request).catch(() => {
    if (request === generation) { more.disabled = false; status.textContent = '加载结果失败，请重试。'; }
  });
});
function restoreQuery() {
  input.value = (new URL(window.location.href).searchParams.get('q') ?? '').slice(0, 500);
  void search();
}
window.addEventListener('popstate', restoreQuery);
restoreQuery();
