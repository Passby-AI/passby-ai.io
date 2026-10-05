import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNavigation } from '../src/lib/navigation-model.ts';
import { postRoute, pageRoute } from '../src/lib/routes.ts';
import { canonicalRoute, listDirectory, parentDirectory, renderTree, resolvePath } from '../src/lib/terminal/filesystem.ts';
import { parseCommand, MAX_INPUT_LENGTH } from '../src/lib/terminal/parser.ts';
import { commands, createCommandRegistry } from '../src/lib/terminal/commands.ts';
import { executeCommand, MAX_HISTORY } from '../src/lib/terminal/executor.ts';
import { appendOutput, HistoryCursor, MAX_OUTPUT, newSession, restoreSession } from '../src/lib/terminal/session.ts';

const posts = [{ data: { slug: 'learning-backtracking', title: '学习回溯' } }, { data: { slug: '中文', title: '中文文章' } }];
const pages = [{ data: { slug: 'about', title: '关于' } }];
const root = buildNavigation(posts, pages, '/terminal_blog/');
const context = (state = { cwd: '~', history: [] }, theme = 'system') => ({ root, state, theme });

test('parser handles whitespace, empty input, quotes, escapes and Unicode', () => {
  assert.deepEqual(parseCommand(' \t '), { kind: 'empty' });
  assert.deepEqual(parseCommand('  cat   "~/posts/中文.md" '), { kind: 'command', name: 'cat', args: ['~/posts/中文.md'] });
  assert.deepEqual(parseCommand("search 'hello world' foo\\ bar"), { kind: 'command', name: 'search', args: ['hello world', 'foo bar'] });
  assert.deepEqual(parseCommand('search ""'), { kind: 'command', name: 'search', args: [''] });
  assert.deepEqual(parseCommand('search "a\\\"b"'), { kind: 'command', name: 'search', args: ['a"b'] });
});

test('parser reports unclosed quotes, dangling escapes, operators and input limits', () => {
  for (const input of ['cat "oops', "cat 'oops", 'cd foo\\', 'ls; home', 'ls | cat', 'ls && pwd', 'ls > file', '`whoami`', 'x'.repeat(MAX_INPUT_LENGTH + 1)]) {
    assert.equal(parseCommand(input).kind, 'error', input);
  }
});

test('filesystem resolves root, relative paths, dot, parents and trailing slashes', () => {
  for (const path of ['~', '/', '~/..', '/../../', '~////']) assert.equal(resolvePath(root, '~/posts', path), root);
  for (const path of ['./posts', '~/posts', '/posts/', 'posts//./']) assert.equal(resolvePath(root, '~', path).path, '~/posts');
  assert.equal(resolvePath(root, '~/posts', '../about.md').route, pageRoute('about', '/terminal_blog/'));
  assert.equal(resolvePath(root, '~/posts', '中文.md').route, postRoute('中文', '/terminal_blog/'));
  assert.equal(parentDirectory(root, '~/posts/中文.md').path, '~/posts');
  assert.equal(parentDirectory(root, '~').path, '~');
});

test('filesystem never traverses a file or silently skips a nonexistent segment', () => {
  for (const path of ['~/about.md/', '~/about.md/..', '~/about.md/.', '~/posts/missing/..', '~/posts/no.md', '~other', 'C:\\Windows']) {
    assert.throws(() => resolvePath(root, '~', path), undefined, path);
  }
  assert.throws(() => listDirectory(resolvePath(root, '~', 'about.md')), /不是目录/);
  assert.equal(listDirectory(resolvePath(root, '~', 'notes')).length, 0);
  assert.throws(() => canonicalRoute(resolvePath(root, '~', 'notes')), /暂无/);
});

test('tree output and directory listings retain shared model order', () => {
  assert.deepEqual(listDirectory(root).map((node) => node.name), ['posts/', 'projects/', 'notes/', 'about.md']);
  assert.deepEqual(renderTree(root), ['~/', '├── posts/', '│   ├── learning-backtracking.md', '│   └── 中文.md', '├── projects/', '├── notes/', '└── about.md']);
});

test('registry contains every required command and permits independent extensions', () => {
  for (const name of ['help', 'ls', 'cd', 'pwd', 'cat', 'open', 'tree', 'search', 'clear', 'history', 'theme', 'home']) assert.ok(commands.has(name));
  const definition = { name: 'test', usage: 'test', description: 'test', minArgs: 0, maxArgs: 0, run: () => ({ lines: ['ok'] }) };
  assert.equal(executeCommand('test', context(), createCommandRegistry([definition])).lines[0], 'ok');
  assert.throws(() => createCommandRegistry([definition, definition]), /Duplicate command/);
});

test('execution is immutable and unknown commands use structured errors', () => {
  const state = { cwd: '~', history: ['help'] };
  const result = executeCommand('rm -rf /', context(state));
  assert.equal(result.error, true);
  assert.match(result.lines[0], /未知命令/);
  assert.deepEqual(state, { cwd: '~', history: ['help'] });
  assert.deepEqual(result.state.history, ['help', 'rm -rf /']);
  assert.equal(result.navigate, undefined);
});

test('empty commands do not enter history; syntax errors do', () => {
  assert.equal(executeCommand('  ', context()).state.history.length, 0);
  const result = executeCommand('ls; home', context());
  assert.equal(result.error, true);
  assert.equal(result.state.history.length, 1);
  assert.equal(result.navigate, undefined);
  assert.equal(executeCommand('x'.repeat(MAX_INPUT_LENGTH + 1), context()).state.history.length, 0);
});

test('directory commands and command history operate deterministically', () => {
  let result = executeCommand('cd posts', context());
  assert.equal(result.state.cwd, '~/posts');
  result = executeCommand('pwd', context(result.state));
  assert.deepEqual(result.lines, ['~/posts']);
  result = executeCommand('ls', context(result.state));
  assert.deepEqual(result.lines, ['learning-backtracking.md', '中文.md']);
  result = executeCommand('history', context(result.state));
  assert.deepEqual(result.lines, ['1  cd posts', '2  pwd', '3  ls', '4  history']);
  assert.equal(executeCommand('cd', context(result.state)).state.cwd, '~');
  assert.match(executeCommand('ls ~/notes', context()).lines[0], /空目录/);
});

test('cat/open/home return exactly the sidebar canonical destinations for root and subpath hosting', () => {
  for (const base of ['/', '/terminal_blog/']) {
    const tree = buildNavigation(posts, pages, base);
    const ctx = { ...context(), root: tree };
    for (const command of ['cat', 'open']) {
      assert.equal(executeCommand(`${command} ~/posts/中文.md`, ctx).navigate, tree.children[0].children[1].route);
      assert.equal(executeCommand(`${command} ~/about.md`, ctx).navigate, pageRoute('about', base));
    }
    assert.equal(executeCommand('open ~/posts', ctx).navigate, tree.children[0].route);
    assert.equal(executeCommand('open', ctx).navigate, tree.route);
    const home = executeCommand('home', { ...ctx, state: { cwd: '~/posts', history: [] } });
    assert.equal(home.navigate, tree.route);
    assert.equal(home.state.cwd, '~');
  }
});

test('missing paths, file cd, directory cat and placeholder open give feedback without navigation', () => {
  for (const command of ['cd ~/about.md', 'cat ~/posts', 'open ~/projects', 'cat nonexistent.md', 'open https://evil.example']) {
    const result = executeCommand(command, context());
    assert.equal(result.error, true, command);
    assert.equal(result.state.cwd, '~');
    assert.equal(result.navigate, undefined);
  }
});

test('command argument arities are enforced', () => {
  for (const command of ['cat', 'pwd extra', 'ls one two', 'cd one two', 'help extra', 'home extra', 'search', 'theme dark extra', 'clear extra', 'history extra', 'tree a b', 'open a b']) {
    assert.match(executeCommand(command, context()).lines[0], /用法/, command);
  }
});

test('themes produce effects for the existing GUI controller and read its current state', () => {
  for (const theme of ['light', 'dark', 'system']) {
    assert.equal(executeCommand(`theme ${theme}`, context()).theme, theme);
    assert.match(executeCommand('theme', context(undefined, theme)).lines[0], new RegExp(theme));
  }
  assert.equal(executeCommand('theme neon', context()).error, true);
});

test('help/tree/search/clear have documented behavior without side effects', () => {
  assert.ok(executeCommand('help', context()).lines.some((line) => line.startsWith('search')));
  assert.deepEqual(executeCommand('tree', context()).lines, renderTree(root));
  assert.equal(executeCommand('search hello world', context()).navigate, '/terminal_blog/search/?q=hello%20world');
  assert.equal(executeCommand('search ""', context()).error, true);
  const result = executeCommand('clear', context({ cwd: '~/posts', history: ['ls'] }));
  assert.equal(result.clear, true);
  assert.deepEqual(result.lines, []);
  assert.deepEqual(result.state.history, ['ls', 'clear']);
  assert.equal(result.state.cwd, '~/posts');
});

test('history is bounded and includes repeated commands', () => {
  const state = { cwd: '~', history: Array(MAX_HISTORY).fill('pwd') };
  const result = executeCommand('pwd', context(state));
  assert.equal(result.state.history.length, MAX_HISTORY);
  assert.equal(result.state.history.at(-1), 'pwd');
});

test('history recall restores the unsent draft and handles boundaries', () => {
  const cursor = new HistoryCursor();
  const history = ['ls', 'pwd'];
  assert.equal(cursor.recall('next', history, 'draft'), 'draft');
  assert.equal(cursor.recall('previous', history, 'draft'), 'pwd');
  assert.equal(cursor.recall('previous', history, 'pwd'), 'ls');
  assert.equal(cursor.recall('previous', history, 'ls'), 'ls');
  assert.equal(cursor.recall('next', history, 'ls'), 'pwd');
  assert.equal(cursor.recall('next', history, 'pwd'), 'draft');
  cursor.reset();
  assert.equal(cursor.recall('previous', [], 'new draft'), 'new draft');
});

test('session persists cwd, transcript, input and open state without trusting stored routes', () => {
  const saved = { ...newSession(), cwd: '~/posts', open: true, history: ['cd posts'], draft: 'cat ', focusOnLoad: true,
    output: [{ kind: 'output', text: '<img src=x onerror=alert(1)>' }], navigate: 'https://evil.example' };
  const restored = restoreSession(JSON.stringify(saved), root);
  assert.equal(restored.cwd, '~/posts');
  assert.equal(restored.open, true);
  assert.equal(restored.draft, 'cat ');
  assert.equal(restored.output[0].text, '<img src=x onerror=alert(1)>');
  assert.equal('navigate' in restored, false);
});

test('corrupt, obsolete and oversized sessions recover without throwing', () => {
  for (const value of [null, '{', 'null', '{}', JSON.stringify({ version: 0 }), 'x'.repeat(1000001)]) {
    assert.deepEqual(restoreSession(value, root), newSession());
  }
  for (const cwd of ['~/removed', '~/about.md']) assert.equal(restoreSession(JSON.stringify({ ...newSession(), cwd }), root).cwd, '~');
  const malformed = restoreSession(JSON.stringify({ version: 1, history: [1, '', 'ok'], output: [null, {}, { kind: 'script', text: 'no' }] }), root);
  assert.deepEqual(malformed.history, ['ok']);
  assert.deepEqual(malformed.output, []);
});

test('transcript and restored history have bounded sizes', () => {
  const session = newSession();
  appendOutput(session, Array.from({ length: MAX_OUTPUT + 10 }, (_, index) => ({ kind: 'output', text: String(index) })));
  assert.equal(session.output.length, MAX_OUTPUT);
  assert.equal(session.output[0].text, '10');
  session.history = Array(MAX_HISTORY + 10).fill('ls');
  session.output.push({ kind: 'output', text: 'x'.repeat(10000) });
  const restored = restoreSession(JSON.stringify(session), root);
  assert.equal(restored.output.length, MAX_OUTPUT);
  assert.equal(restored.output.at(-1).text.length, 3000);
  assert.equal(restored.history.length, MAX_HISTORY);
});
