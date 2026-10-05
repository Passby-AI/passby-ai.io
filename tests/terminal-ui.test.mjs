import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { buildNavigation } from '../src/lib/navigation-model.ts';
import * as executor from '../src/lib/terminal/executor.ts';
import * as sessions from '../src/lib/terminal/session.ts';

// Exercise the actual controller against DOM/storage boundaries without adding
// a browser dependency. Layout and native keyboard behavior still need a browser.
const themeCode = readFileSync(new URL('../src/scripts/theme.js', import.meta.url), 'utf8');
const terminalCode = ts.transpileModule(readFileSync(new URL('../src/scripts/terminal.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const root = buildNavigation([{ data: { slug: 'example', title: 'Example' } }], [{ data: { slug: 'about', title: '关于' } }], '/blog/');

function fixture({ stored = new Map(), pathname = '/blog/', search = '', blocked = false } = {}) {
  const doc = new EventTarget();
  class Element extends EventTarget {
    constructor(name) {
      super(); this.name = name; this.dataset = {}; this.attributes = new Map(); this.children = [];
      this.parent = null; this.text = ''; this.value = ''; this.disabled = true; this.hidden = true;
      this.isConnected = true; this.scrollHeight = 0;
    }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text + this.children.map((child) => child.textContent).join('\n'); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    append(child) { child.parent = this; this.children.push(child); }
    replaceChildren() { this.children = []; this.text = ''; }
    contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
    focus() { doc.activeElement = this; }
    setSelectionRange() {}
  }
  class Select extends Element { matches(selector) { return selector === '[data-theme-control]'; } }
  const elements = Object.fromEntries(['panel', 'input', 'form', 'output', 'announcement', 'toggle', 'hint', 'close', 'cwd', 'location', 'theme', 'body', 'html', 'navigation'].map((name) => [name, new Element(name)]));
  const select = new Select('select');
  elements.hint.dataset.terminalCommand = 'help';
  elements.navigation.textContent = JSON.stringify(root);
  for (const name of ['input', 'form', 'output', 'announcement', 'close', 'cwd', 'location', 'theme']) elements.panel.append(elements[name]);
  const panelQueries = {
    '#terminal-input': elements.input, '[data-terminal-form]': elements.form,
    '[data-terminal-output]': elements.output, '[data-terminal-announcement]': elements.announcement,
    '[data-terminal-cwd]': elements.cwd, '[data-terminal-location]': elements.location,
    '[data-terminal-theme]': elements.theme, '[data-terminal-close]': elements.close,
  };
  elements.panel.querySelector = (selector) => panelQueries[selector] ?? null;
  doc.querySelector = (selector) => ({ '#terminal-panel': elements.panel, '#blog-navigation': elements.navigation })[selector] ?? null;
  doc.querySelectorAll = (selector) => ({ '[data-terminal-toggle]': [elements.toggle], '[data-terminal-command]': [elements.hint], '[data-theme-control]': [select] })[selector] ?? [];
  doc.createElement = (name) => new Element(name);
  doc.body = doc.activeElement = elements.body;
  doc.documentElement = elements.html;
  const win = new EventTarget();
  const destinations = [];
  win.location = { origin: 'https://example.test', pathname, search, assign: (url) => destinations.push(url) };
  const storage = {
    getItem(key) { if (blocked) throw new Error('storage blocked'); return stored.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('storage blocked'); stored.set(key, value); },
  };
  const sandbox = vm.createContext({ window: win, document: doc, HTMLElement: Element, HTMLSelectElement: Select,
    localStorage: storage, sessionStorage: storage, CustomEvent, URL,
    requestAnimationFrame: (callback) => { callback(); return 1; }, exports: {},
    require: (name) => {
      if (name === '../lib/terminal/executor') return executor;
      if (name === '../lib/terminal/session') return sessions;
      throw new Error(`Unexpected browser dependency: ${name}`);
    },
  });
  vm.runInContext(themeCode, sandbox);
  vm.runInContext(terminalCode, sandbox);
  doc.dispatchEvent(new Event('DOMContentLoaded'));
  function fire(target, type, properties = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, properties);
    target.dispatchEvent(event);
    return event;
  }
  function submit(text) { elements.input.value = text; fire(elements.form, 'submit'); }
  return { ...elements, select, doc, win, stored, destinations, fire, submit,
    session: () => JSON.parse(stored.get('akira-blog:terminal:/blog/')) };
}

test('UI toggle/shortcut focuses input, Escape restores focus, and Tab is not intercepted', () => {
  const app = fixture();
  assert.equal(app.panel.hidden, true);
  assert.equal(app.toggle.disabled, false);
  app.toggle.focus();
  app.fire(app.toggle, 'click');
  assert.equal(app.panel.hidden, false);
  assert.equal(app.doc.activeElement, app.input);
  assert.equal(app.toggle.attributes.get('aria-expanded'), 'true');
  assert.equal(app.fire(app.doc, 'keydown', { key: 'Tab' }).defaultPrevented, false);
  app.fire(app.doc, 'keydown', { key: 'Escape' });
  assert.equal(app.panel.hidden, true);
  assert.equal(app.doc.activeElement, app.toggle);
  const event = app.fire(app.doc, 'keydown', { code: 'Backquote', key: '`', ctrlKey: true });
  assert.equal(event.defaultPrevented, true);
  assert.equal(app.doc.activeElement, app.input);
  app.fire(app.doc, 'keydown', { code: 'Backquote', key: '`', ctrlKey: true, repeat: true });
  assert.equal(app.panel.hidden, false);
});

test('UI help hint prefills input; commands render as text and clear leaves history', () => {
  const app = fixture();
  app.fire(app.hint, 'click');
  assert.equal(app.input.value, 'help');
  assert.equal(app.session().history.length, 0);
  app.submit('help');
  assert.match(app.output.textContent, /博客虚拟文件系统/);
  app.submit('search "<svg onload=alert(1)>"');
  assert.ok(app.output.children.every((child) => child.name === 'p'));
  assert.ok(app.output.textContent.includes('<svg onload=alert(1)>'));
  app.submit('clear');
  assert.equal(app.output.textContent, '');
  assert.equal(app.session().history.at(-1), 'clear');
});

test('UI and terminal use the same actual theme controller in both directions', () => {
  const app = fixture();
  app.submit('theme dark');
  assert.equal(app.select.value, 'dark');
  assert.equal(app.html.dataset.theme, 'dark');
  assert.equal(app.theme.textContent, 'dark');
  app.select.value = 'light';
  // Dispatch with the select as event target, as a bubbling change would do.
  const event = new Event('change');
  Object.defineProperty(event, 'target', { value: app.select });
  app.doc.dispatchEvent(event);
  app.submit('theme');
  assert.equal(app.win.blogTheme.get(), 'light');
  assert.match(app.output.textContent, /当前主题：light/);
});

test('UI navigation preserves history/cwd and transfers focus only for terminal navigation', () => {
  const app = fixture();
  app.fire(app.toggle, 'click');
  app.submit('cd posts');
  app.submit('cat example.md');
  assert.deepEqual(app.destinations, ['https://example.test/blog/posts/example/']);
  assert.equal(app.session().focusOnLoad, true);
  const next = fixture({ stored: app.stored, pathname: '/blog/posts/example/' });
  assert.equal(next.cwd.textContent, '~/posts');
  assert.equal(next.doc.activeElement, next.input);
  assert.equal(next.panel.hidden, false);
  assert.equal(next.session().focusOnLoad, false);
  const guiNavigation = fixture({ stored: next.stored, pathname: '/blog/about/' });
  assert.equal(guiNavigation.panel.hidden, false);
  assert.equal(guiNavigation.doc.activeElement, guiNavigation.body);
  guiNavigation.submit('home');
  assert.equal(guiNavigation.session().cwd, '~');
  assert.deepEqual(guiNavigation.destinations, ['https://example.test/blog/']);
});

test('terminal search on the search page navigates when only the query changes', () => {
  const app = fixture({ pathname: '/blog/search/', search: '?q=old' });
  app.submit('cd posts');
  app.submit('search 中文');
  assert.deepEqual(app.destinations, ['https://example.test/blog/search/?q=%E4%B8%AD%E6%96%87']);
  assert.equal(app.session().cwd, '~/posts');
  const identical = fixture({ pathname: '/blog/search/', search: '?q=old' });
  identical.submit('search old');
  assert.deepEqual(identical.destinations, []);
});

test('UI history arrows restore draft; IME composition does not submit or consume shortcuts', () => {
  const app = fixture();
  app.submit('pwd');
  app.input.value = 'unfinished';
  app.fire(app.input, 'input');
  app.fire(app.input, 'keydown', { key: 'ArrowUp' });
  assert.equal(app.input.value, 'pwd');
  app.fire(app.input, 'keydown', { key: 'ArrowDown' });
  assert.equal(app.input.value, 'unfinished');
  app.fire(app.input, 'compositionstart');
  app.submit('ls');
  assert.equal(app.session().history.length, 1);
  assert.equal(app.fire(app.doc, 'keydown', { key: '`', ctrlKey: true }).defaultPrevented, false);
  app.fire(app.input, 'compositionend');
  app.submit('ls');
  assert.equal(app.session().history.length, 2);
});

test('UI handles storage denial and BFCache restores the latest session without stealing focus', () => {
  const blocked = fixture({ blocked: true });
  blocked.fire(blocked.toggle, 'click');
  blocked.submit('cd posts');
  blocked.submit('theme dark');
  assert.equal(blocked.cwd.textContent, '~/posts');
  assert.equal(blocked.html.dataset.theme, 'dark');
  const previous = fixture();
  const current = fixture({ stored: previous.stored });
  current.fire(current.toggle, 'click');
  current.submit('cd posts');
  previous.fire(previous.win, 'pageshow', { persisted: true });
  assert.equal(previous.panel.hidden, false);
  assert.equal(previous.cwd.textContent, '~/posts');
  assert.equal(previous.doc.activeElement, previous.body);
});
