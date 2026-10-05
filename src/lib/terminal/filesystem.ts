import type { NavigationNode } from '../navigation-model.ts';

export class FilesystemError extends Error {}

function childName(node: NavigationNode): string { return node.name.replace(/\/$/, ''); }

/** Resolve virtual paths by walking nodes, including intermediate type checks. */
export function resolvePath(root: NavigationNode, cwd: string, input: string = '.'): NavigationNode {
  if (/[\\\u0000-\u001f]/u.test(input) || (input.startsWith('~') && input !== '~' && !input.startsWith('~/'))) {
    throw new FilesystemError(`无效的虚拟路径：${input}`);
  }
  const absolute = input.startsWith('/') || input.startsWith('~');
  const path = absolute ? input.replace(/^~\/?/, '') : `${cwd.replace(/^~\/?/, '')}/${input}`;
  const stack = [root];
  const segments = path.split('/');
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    const current = stack.at(-1)!;
    // Empty final segment in a trailing slash still requires a directory.
    if (segment === '' && index === 0) continue;
    if (current.type !== 'directory') throw new FilesystemError(`不是目录：${current.path}`);
    if (segment === '' || segment === '.') continue;
    if (segment === '..') { if (stack.length > 1) stack.pop(); continue; }
    const next = current.children?.find((node) => childName(node) === segment);
    if (!next) throw new FilesystemError(`路径不存在：${input}`);
    stack.push(next);
  }
  return stack.at(-1)!;
}

export function listDirectory(node: NavigationNode): NavigationNode[] {
  if (node.type !== 'directory') throw new FilesystemError(`不是目录：${node.path}`);
  return [...(node.children ?? [])];
}

export function parentDirectory(root: NavigationNode, path: string): NavigationNode {
  const parent = path.split('/').slice(0, -1).join('/') || '~';
  return resolvePath(root, '~', parent);
}

export function canonicalRoute(node: NavigationNode): string {
  if (!node.route) throw new FilesystemError(`${node.path} 暂无可打开的页面。`);
  return node.route;
}

export function renderTree(node: NavigationNode): string[] {
  const lines = [node.name];
  function visit(parent: NavigationNode, prefix: string) {
    const children = parent.children ?? [];
    children.forEach((child, index) => {
      const last = index === children.length - 1;
      lines.push(`${prefix}${last ? '└── ' : '├── '}${child.name}`);
      visit(child, `${prefix}${last ? '    ' : '│   '}`);
    });
  }
  visit(node, '');
  return lines;
}
