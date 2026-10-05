import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../src/scripts/theme.js', import.meta.url), 'utf8');

function browser(saved = null, blocked = false) {
  const listeners = new Map();
  class Select {
    value = 'system'; disabled = true;
    matches() { return true; }
  }
  const control = new Select();
  const storage = new Map(saved === null ? [] : [['akira-blog:theme', saved]]);
  const document = { documentElement: { dataset: {} }, querySelectorAll: () => [control],
    addEventListener: (name, fn) => listeners.set(name, fn), dispatchEvent: () => {} };
  const window = { addEventListener: (name, fn) => listeners.set(name, fn) };
  const localStorage = {
    getItem: (key) => { if (blocked) throw new Error('blocked'); return storage.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw new Error('blocked'); storage.set(key, value); },
  };
  vm.runInNewContext(script, { window, document, localStorage, HTMLSelectElement: Select,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
  return { window, document, storage, control, listeners };
}

test('theme is restored synchronously before DOMContentLoaded and survives reload', () => {
  for (const mode of ['light', 'dark', 'system']) {
    const state = browser(mode);
    assert.equal(state.document.documentElement.dataset.theme, mode);
    assert.equal(state.control.value, mode);
    assert.equal(state.control.disabled, false);
    state.window.blogTheme.set('dark');
    assert.equal(browser(state.storage.get('akira-blog:theme')).window.blogTheme.get(), 'dark');
  }
});

test('invalid preference and blocked storage remain usable', () => {
  assert.equal(browser('invalid').window.blogTheme.get(), 'system');
  const state = browser(null, true);
  state.window.blogTheme.set('light');
  assert.equal(state.control.value, 'light');
});

test('GUI and shared API agree; storage events and back-forward cache resync', () => {
  const state = browser();
  state.control.value = 'dark';
  state.listeners.get('change')({ target: state.control });
  assert.equal(state.window.blogTheme.get(), 'dark');
  state.storage.set('akira-blog:theme', 'light');
  state.listeners.get('storage')({ key: 'akira-blog:theme' });
  assert.equal(state.control.value, 'light');
  state.storage.clear();
  state.listeners.get('pageshow')();
  assert.equal(state.window.blogTheme.get(), 'system');
});
