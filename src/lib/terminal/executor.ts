import { commands } from './commands.ts';
import { FilesystemError } from './filesystem.ts';
import { MAX_INPUT_LENGTH, parseCommand } from './parser.ts';
import type { CommandContext, CommandDefinition, ExecutionResult } from './types.ts';

export const MAX_HISTORY = 100;

/** Pure execution: effects are returned for the UI to apply, never executed here. */
export function executeCommand(input: string, context: CommandContext,
  registry: ReadonlyMap<string, CommandDefinition> = commands): ExecutionResult {
  const parsed = parseCommand(input);
  const state = { cwd: context.state.cwd, history: [...context.state.history] };
  if (parsed.kind === 'empty') return { state, lines: [] };
  if (input.length <= MAX_INPUT_LENGTH) state.history = [...state.history, input.trim()].slice(-MAX_HISTORY);
  if (parsed.kind === 'error') return { state, lines: [parsed.message], error: true };
  const command = registry.get(parsed.name);
  if (!command) return { state, lines: [`未知命令：${parsed.name}。输入 help 查看可用命令。`], error: true };
  if (parsed.args.length < command.minArgs || parsed.args.length > command.maxArgs) {
    return { state, lines: [`用法：${command.usage}`], error: true };
  }
  try {
    const result = command.run(parsed.args, { ...context, state });
    if (result.cwd) state.cwd = result.cwd;
    return { ...result, state };
  } catch (error) {
    if (!(error instanceof FilesystemError)) throw error;
    return { state, lines: [error.message], error: true };
  }
}
