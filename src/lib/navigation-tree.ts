import type { NavigationNode } from './navigation-model.ts';
import { isCurrentRoute } from './routes.ts';

/** Return whether this node or any descendant resolves to the current route. */
export function containsCurrentRoute(node: NavigationNode, pathname: string): boolean {
  if (node.route && isCurrentRoute(pathname, node.route)) return true;
  return node.children?.some((child) => containsCurrentRoute(child, pathname)) ?? false;
}
