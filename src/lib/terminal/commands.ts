import { canonicalRoute, listDirectory, renderTree, resolvePath } from './filesystem.ts';
import { searchRoute } from '../routes.ts';
import type { CommandContext, CommandDefinition, CommandResult, ThemeMode } from './types.ts';

function resolve(context: CommandContext, path = '.') {
  return resolvePath(context.root, context.state.cwd, path);
}
function open(args: string[], context: CommandContext, filesOnly = false): CommandResult {
  const node = resolve(context, args[0] ?? '.');
  if (filesOnly && node.type === 'directory') return { lines: [`${node.path} 是目录，请使用 open。`], error: true };
  return { lines: [`打开 ${node.path}`], navigate: canonicalRoute(node) };
}

export const commandDefinitions: CommandDefinition[] = [
  { name: 'help', usage: 'help', description: '显示命令与用法', minArgs: 0, maxArgs: 0,
    run: () => ({ lines: [
      '博客虚拟文件系统；不连接系统 shell。路径区分大小写，支持 ~、/、.、.. 和带引号的文件名。',
      ...commandDefinitions.map((command) => `${command.usage.padEnd(28)} ${command.description}`),
      '↑ / ↓ 浏览历史；Ctrl + ` 切换终端；Esc 关闭；Tab 可离开终端。',
    ] }) },
  { name: 'ls', usage: 'ls [path]', description: '列出目录', minArgs: 0, maxArgs: 1,
    run: (args, context) => {
      const children = listDirectory(resolve(context, args[0]));
      return { lines: children.length ? children.map((node) => node.name) : ['（空目录）'] };
    } },
  { name: 'cd', usage: 'cd [path]', description: '切换目录；不带参数回到 ~', minArgs: 0, maxArgs: 1,
    run: (args, context) => {
      const node = resolve(context, args[0] ?? '~');
      listDirectory(node);
      return { lines: [], cwd: node.path };
    } },
  { name: 'pwd', usage: 'pwd', description: '显示当前虚拟目录', minArgs: 0, maxArgs: 0,
    run: (_, context) => ({ lines: [context.state.cwd] }) },
  { name: 'cat', usage: 'cat <file>', description: '打开文章或独立页面', minArgs: 1, maxArgs: 1,
    run: (args, context) => open(args, context, true) },
  { name: 'open', usage: 'open [path]', description: '打开对应网页，默认当前目录', minArgs: 0, maxArgs: 1,
    run: (args, context) => open(args, context) },
  { name: 'tree', usage: 'tree [path]', description: '显示目录树', minArgs: 0, maxArgs: 1,
    run: (args, context) => ({ lines: renderTree(resolve(context, args[0])) }) },
  { name: 'search', usage: 'search <query>', description: '打开全文搜索结果', minArgs: 1, maxArgs: Number.POSITIVE_INFINITY,
    run: (args, context) => {
      const query = args.join(' ').trim();
      return query ? { lines: [`搜索：${query}`], navigate: searchRoute(query, canonicalRoute(context.root)) }
        : { lines: ['请输入搜索关键词。'], error: true };
    } },
  { name: 'clear', usage: 'clear', description: '清空输出，保留命令历史', minArgs: 0, maxArgs: 0,
    run: () => ({ lines: [], clear: true }) },
  { name: 'history', usage: 'history', description: '显示当前标签页的命令历史', minArgs: 0, maxArgs: 0,
    run: (_, context) => ({ lines: context.state.history.map((line, index) => `${index + 1}  ${line}`) }) },
  { name: 'theme', usage: 'theme [light|dark|system]', description: '查看或切换主题', minArgs: 0, maxArgs: 1,
    run: (args, context) => {
      if (args.length === 0) return { lines: [`当前主题：${context.theme}`] };
      if (!['light', 'dark', 'system'].includes(args[0]!)) return { lines: ['用法：theme [light|dark|system]'], error: true };
      return { lines: [`主题已设为 ${args[0]}`], theme: args[0] as ThemeMode };
    } },
  { name: 'home', usage: 'home', description: '打开首页并回到 ~', minArgs: 0, maxArgs: 0,
    run: (_, context) => ({ lines: ['打开首页'], cwd: '~', navigate: canonicalRoute(context.root) }) },
];

export function createCommandRegistry(definitions: CommandDefinition[]): ReadonlyMap<string, CommandDefinition> {
  const registry = new Map<string, CommandDefinition>();
  for (const definition of definitions) {
    if (registry.has(definition.name)) throw new Error(`Duplicate command: ${definition.name}`);
    registry.set(definition.name, definition);
  }
  return registry;
}

export const commands = createCommandRegistry(commandDefinitions);
