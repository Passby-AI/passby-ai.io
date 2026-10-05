import type { NavigationNode } from '../navigation-model.ts';

export type ThemeMode = 'light' | 'dark' | 'system';
export interface TerminalState { cwd: string; history: string[] }
export interface CommandContext {
  root: NavigationNode;
  state: TerminalState;
  theme: ThemeMode;
}
export interface CommandResult {
  lines: string[];
  error?: boolean;
  cwd?: string;
  navigate?: string;
  theme?: ThemeMode;
  clear?: boolean;
}
export interface CommandDefinition {
  name: string;
  usage: string;
  description: string;
  minArgs: number;
  maxArgs: number;
  run: (args: string[], context: CommandContext) => CommandResult;
}
export interface ExecutionResult extends CommandResult { state: TerminalState }
