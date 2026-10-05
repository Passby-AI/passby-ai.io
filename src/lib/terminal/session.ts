import type { NavigationNode } from '../navigation-model.ts';
import type { TerminalState } from './types.ts';
import { resolvePath } from './filesystem.ts';
import { MAX_HISTORY } from './executor.ts';
import { MAX_INPUT_LENGTH } from './parser.ts';

export interface OutputLine { kind: 'command' | 'output' | 'error'; text: string }
export interface TerminalSession extends TerminalState {
  version: 1;
  open: boolean;
  output: OutputLine[];
  draft: string;
  focusOnLoad: boolean;
}
export const MAX_OUTPUT = 200;
const MAX_OUTPUT_LENGTH = 3000;

export function newSession(): TerminalSession {
  return { version: 1, cwd: '~', history: [], open: false, output: [], draft: '', focusOnLoad: false };
}

/** Stored data contains no executable markup or routes; revalidate cwd on each page. */
export function restoreSession(serialized: string | null, root: NavigationNode): TerminalSession {
  const session = newSession();
  if (!serialized || serialized.length > 1000000) return session;
  try {
    const saved = JSON.parse(serialized);
    if (!saved || saved.version !== 1) return session;
    if (typeof saved.cwd === 'string') {
      try {
        const directory = resolvePath(root, '~', saved.cwd);
        if (directory.type === 'directory') session.cwd = directory.path;
      } catch { /* Content may have changed since the previous visit. */ }
    }
    session.open = saved.open === true;
    session.focusOnLoad = saved.focusOnLoad === true;
    session.draft = typeof saved.draft === 'string' ? saved.draft.slice(0, MAX_INPUT_LENGTH) : '';
    if (Array.isArray(saved.history)) session.history = saved.history
      .filter((line: unknown): line is string => typeof line === 'string' && line.length <= MAX_INPUT_LENGTH && line.trim().length > 0)
      .slice(-MAX_HISTORY);
    if (Array.isArray(saved.output)) session.output = saved.output
      .filter((line: unknown): line is OutputLine => !!line && typeof line === 'object' &&
        'kind' in line && ['command', 'output', 'error'].includes(String(line.kind)) &&
        'text' in line && typeof line.text === 'string')
      .slice(-MAX_OUTPUT).map((line: OutputLine) => ({ kind: line.kind, text: line.text.slice(0, MAX_OUTPUT_LENGTH) }));
  } catch { /* Corrupt or unavailable storage starts a fresh session. */ }
  return session;
}

export function appendOutput(session: TerminalSession, lines: OutputLine[]): void {
  session.output = [...session.output, ...lines.map((line) => ({ ...line, text: line.text.slice(0, MAX_OUTPUT_LENGTH) }))].slice(-MAX_OUTPUT);
}

export class HistoryCursor {
  private index: number | undefined;
  private draft = '';
  reset(): void { this.index = undefined; this.draft = ''; }
  recall(direction: 'previous' | 'next', history: string[], input: string): string {
    if (!history.length) return input;
    if (this.index === undefined) {
      if (direction === 'next') return input;
      this.index = history.length;
      this.draft = input;
    }
    this.index = Math.max(0, Math.min(history.length, this.index + (direction === 'previous' ? -1 : 1)));
    return this.index === history.length ? this.draft : history[this.index]!;
  }
}
