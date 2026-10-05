import { homeRoute, pageRoute, postRoute, postsRoute } from './routes.ts';

export interface NavigationNode {
  name: string;
  title: string;
  type: 'directory' | 'post' | 'page';
  path: string;
  route?: string;
  children?: NavigationNode[];
}

interface NavigableEntry { data: { slug: string; title: string; categories?: string[] } }

function buildPostTree(posts: NavigableEntry[], base?: string): NavigationNode[] {
  const groups = new Map<string, NavigableEntry[]>();
  const uncategorized: NavigableEntry[] = [];
  for (const post of posts) {
    const categories = post.data.categories?.filter(Boolean) ?? [];
    if (!categories.length) { uncategorized.push(post); continue; }
    groups.set(categories[0]!, [...(groups.get(categories[0]!) ?? []), post]);
  }
  const directory = (name: string, parent: string, values: NavigableEntry[]): NavigationNode => {
    const path = parent ? `${parent}/${name}` : name;
    return { name: `${name}/`, title: name, type: 'directory', path: `~/posts/${path}`,
      children: values.map((post) => ({ name: `${post.data.slug}.md`, title: post.data.title,
        type: 'post' as const, path: `~/posts/${path}/${post.data.slug}.md`, route: postRoute(post.data.slug, base) })) };
  };
  const result = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh-CN')).map(([category, values]) => {
    const direct = values.filter((post) => (post.data.categories?.filter(Boolean).length ?? 0) < 2);
    const subgroups = new Map<string, NavigableEntry[]>();
    for (const post of values) {
      const subcategory = post.data.categories?.filter(Boolean)[1];
      if (subcategory) subgroups.set(subcategory, [...(subgroups.get(subcategory) ?? []), post]);
    }
    const node = directory(category, '', direct);
    node.children = [...node.children ?? [], ...[...subgroups.entries()].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'))
      .map(([subcategory, subvalues]) => directory(subcategory, category, subvalues))];
    return node;
  });
  // Keep uncategorized posts directly under posts/ for backwards-compatible paths.
  result.push(...uncategorized.map((post) => ({ name: `${post.data.slug}.md`, title: post.data.title,
    type: 'post' as const, path: `~/posts/${post.data.slug}.md`, route: postRoute(post.data.slug, base) })));
  return result;
}

/** One tree for sidebar, terminal and future search; inputs are published entries. */
export function buildNavigation(posts: NavigableEntry[], pages: NavigableEntry[], base?: string): NavigationNode {
  return {
    name: '~/', title: '首页', type: 'directory', path: '~', route: homeRoute(base),
    children: [
      { name: 'posts/', title: '归档', type: 'directory', path: '~/posts', route: postsRoute(base), children: buildPostTree(posts, base) },
      { name: 'projects/', title: '项目 · 暂无内容', type: 'directory', path: '~/projects' },
      { name: 'notes/', title: '笔记 · 暂无内容', type: 'directory', path: '~/notes' },
      ...pages.map((page): NavigationNode => ({ name: `${page.data.slug}.md`, title: page.data.title,
        type: 'page', path: `~/${page.data.slug}.md`, route: pageRoute(page.data.slug, base) })),
    ],
  };
}
