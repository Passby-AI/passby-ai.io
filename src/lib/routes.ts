import { validateSlug } from './slug.ts';

/** Input paths are site-relative; add the deployment base exactly once here. */
export function withBase(path: string, base: string = import.meta.env?.BASE_URL ?? '/'): string {
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
  return `${prefix}/${path.replace(/^\/+/, '')}`;
}

export const homeRoute = (base?: string) => withBase('', base);
export const postsRoute = (base?: string) => withBase('posts/', base);
export const searchRoute = (query = '', base?: string) => withBase('search/', base) + (query ? `?q=${encodeURIComponent(query)}` : '');
export const postRoute = (slug: string, base?: string) => withBase(`posts/${encodeURIComponent(validateSlug(slug))}/`, base);
export const pageRoute = (slug: string, base?: string) => withBase(`${encodeURIComponent(validateSlug(slug))}/`, base);

export function isCurrentRoute(pathname: string, route: string): boolean {
  const normalize = (path: string) => decodeURI(path).replace(/\/+$/, '') || '/';
  return normalize(pathname) === normalize(route);
}

export function assertPageRoute(slug: string, source: string): void {
  if (['posts', 'projects', 'notes', 'search', 'pagefind', 'published-assets', 'index', '404', '_astro'].includes(slug.toLowerCase())) {
    throw new Error(`${source}: page slug "${slug}" collides with a reserved route`);
  }
}
