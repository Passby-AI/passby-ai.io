import { getPages, getPosts } from './posts';
import { buildNavigation, type NavigationNode } from './navigation-model';
export type { NavigationNode } from './navigation-model';

/** Only this server entry point reads Astro collections. */
export async function getNavigation(): Promise<NavigationNode> {
  const [posts, pages] = await Promise.all([getPosts(), getPages()]);
  return buildNavigation(posts, pages);
}
