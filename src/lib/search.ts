import type { NavigationNode } from './navigation-model.ts';

export interface SearchHit { url: string; meta: { title?: string }; excerpt: string }
export interface SearchResult { route: string; title: string; excerpt: string }

/** Only published, canonical content destinations from the shared tree are accepted. */
export function canonicalSearchResult(hit: SearchHit, root: NavigationNode): SearchResult | undefined {
  const pathname = new URL(hit.url, 'https://blog.invalid').pathname;
  const normalize = (value: string) => { try { return decodeURI(value).replace(/\/+$/, ''); } catch { return value; } };
  function find(node: NavigationNode): NavigationNode | undefined {
    if (node.type !== 'directory' && node.route && normalize(node.route) === normalize(pathname)) return node;
    return node.children?.map(find).find(Boolean);
  }
  const node = find(root);
  return node?.route ? { route: node.route, title: node.title, excerpt: hit.excerpt } : undefined;
}
