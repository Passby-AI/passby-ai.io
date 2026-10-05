import type { NavigationNode } from '../lib/navigation-model';
import type { ThemeMode } from '../lib/terminal/types';
import { executeCommand } from '../lib/terminal/executor';
import { appendOutput, HistoryCursor, newSession, restoreSession } from '../lib/terminal/session';

declare global {
  interface Window {
    blogTheme: { get(): ThemeMode; set(theme: ThemeMode): void };
  }
}

const panel = document.querySelector<HTMLElement>('#terminal-panel')!;
const root: NavigationNode = JSON.parse(document.querySelector('#blog-navigation')!.textContent!);
const input = panel.querySelector<HTMLInputElement>('#terminal-input')!;
const form = panel.querySelector<HTMLFormElement>('[data-terminal-form]')!;
const output = panel.querySelector<HTMLElement>('[data-terminal-output]')!;
const announcement = panel.querySelector<HTMLElement>('[data-terminal-announcement]')!;
const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-terminal-toggle]')];
const storageKey = `akira-blog:terminal:${root.route}`;
const historyCursor = new HistoryCursor();
let returnFocus: HTMLElement | null = null;
let storageAvailable = true;
let composing = false;

function readSession() {
  try { return restoreSession(sessionStorage.getItem(storageKey), root); }
  catch { storageAvailable = false; return newSession(); }
}
let session = readSession();

function saveSession() {
  try { sessionStorage.setItem(storageKey, JSON.stringify(session)); }
  catch { storageAvailable = false; }
}

function syncTheme() {
  panel.querySelector('[data-terminal-theme]')!.textContent = window.blogTheme.get();
}

function syncPanel() {
  panel.hidden = !session.open;
  document.documentElement.dataset.terminalOpen = String(session.open);
  toggles.forEach((button) => {
    button.disabled = false;
    button.setAttribute('aria-expanded', String(session.open));
    button.setAttribute('aria-label', session.open ? '关闭终端' : '打开终端');
  });
  panel.querySelector('[data-terminal-cwd]')!.textContent = session.cwd;
  panel.querySelector('[data-terminal-location]')!.textContent = `当前目录：${session.cwd}`;
  syncTheme();
}

function renderOutput() {
  output.replaceChildren();
  if (!session.output.length && !session.history.length) {
    const welcome = document.createElement('p');
    welcome.textContent = '输入 help 查看命令。这里浏览的是博客的虚拟文件系统。';
    output.append(welcome);
  }
  for (const line of session.output) {
    const paragraph = document.createElement('p');
    paragraph.className = `terminal-${line.kind}`;
    // User input, content titles and restored session data must always stay text.
    paragraph.textContent = line.text;
    output.append(paragraph);
  }
  output.scrollTop = output.scrollHeight;
}

function openTerminal(trigger?: HTMLElement) {
  if (!session.open) returnFocus = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  session.open = true;
  syncPanel();
  saveSession();
  input.focus({ preventScroll: true });
  output.scrollTop = output.scrollHeight;
}

function closeTerminal() {
  // Keep external focus in place if the shortcut closes a panel the user left.
  const wasInside = panel.contains(document.activeElement);
  session.open = false;
  session.focusOnLoad = false;
  syncPanel();
  saveSession();
  if (wasInside) {
    const target = returnFocus?.isConnected && returnFocus !== document.body && !panel.contains(returnFocus) ? returnFocus : toggles[0];
    target?.focus({ preventScroll: true });
  }
}

function announce(message: string) {
  announcement.textContent = '';
  // Separate identical consecutive results so screen readers announce each one.
  requestAnimationFrame(() => { announcement.textContent = message; });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (composing) return;
  const command = input.value;
  if (!command.trim()) return;
  const previousCwd = session.cwd;
  const result = executeCommand(command, { root, state: session, theme: window.blogTheme.get() });
  session.cwd = result.state.cwd;
  session.history = result.state.history;
  session.draft = '';
  input.value = '';
  historyCursor.reset();
  if (result.clear) session.output = [];
  else appendOutput(session, [
    { kind: 'command', text: `akira@blog:${previousCwd}$ ${command}` },
    ...result.lines.map((text) => ({ kind: result.error ? 'error' as const : 'output' as const, text })),
  ]);
  if (result.theme) window.blogTheme.set(result.theme);
  syncPanel();
  renderOutput();
  saveSession();
  announce(result.clear ? '输出已清空。' : result.lines.join('\n') || `当前目录：${session.cwd}`);
  input.focus({ preventScroll: true });

  if (result.navigate) {
    // Content routes come from the tree; search uses the shared route helper.
    const destination = new URL(result.navigate, window.location.origin);
    if (destination.origin !== window.location.origin) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
    if (!storageAvailable) {
      appendOutput(session, [{ kind: 'error', text: '浏览器禁止会话存储，跳转后无法保留终端历史。再次执行命令仍可正常使用。' }]);
      renderOutput();
    }
    session.focusOnLoad = true;
    saveSession();
    window.location.assign(destination.href);
  }
});

input.addEventListener('compositionstart', () => { composing = true; });
input.addEventListener('compositionend', () => { composing = false; });
input.addEventListener('blur', () => { composing = false; });
input.addEventListener('input', () => {
  session.draft = input.value;
  historyCursor.reset();
  saveSession();
});
input.addEventListener('keydown', (event) => {
  if (event.isComposing || composing || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  input.value = historyCursor.recall(event.key === 'ArrowUp' ? 'previous' : 'next', session.history, input.value);
  input.setSelectionRange(input.value.length, input.value.length);
  session.draft = input.value;
  saveSession();
});

document.addEventListener('keydown', (event) => {
  if (event.isComposing || composing) return;
  if (event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && (event.code === 'Backquote' || event.key === '`')) {
    event.preventDefault();
    if (event.repeat) return;
    if (session.open) closeTerminal(); else openTerminal();
  } else if (event.key === 'Escape' && session.open && !event.defaultPrevented && panel.contains(document.activeElement)) {
    event.preventDefault();
    closeTerminal();
  }
});

toggles.forEach((button) => button.addEventListener('click', () => {
  if (session.open) closeTerminal(); else openTerminal(button);
}));
panel.querySelector('[data-terminal-close]')!.addEventListener('click', closeTerminal);
document.querySelectorAll<HTMLButtonElement>('[data-terminal-command]').forEach((button) => {
  button.disabled = false;
  button.setAttribute('aria-controls', 'terminal-panel');
  button.addEventListener('click', () => {
    openTerminal(button);
    input.value = button.dataset.terminalCommand ?? '';
    session.draft = input.value;
    historyCursor.reset();
    saveSession();
  });
});
document.addEventListener('blog:theme-change', syncTheme);
window.addEventListener('pagehide', saveSession);
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  // BFCache may restore an older JS heap; use the latest tab session without
  // overriding the browser's own scroll/focus restoration.
  session = readSession();
  session.focusOnLoad = false;
  input.value = session.draft;
  historyCursor.reset();
  syncPanel();
  renderOutput();
  saveSession();
});

input.value = session.draft;
syncPanel();
renderOutput();
if (session.open && session.focusOnLoad) input.focus({ preventScroll: true });
session.focusOnLoad = false;
saveSession();
