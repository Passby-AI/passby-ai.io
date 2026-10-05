export type ParseResult =
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'command'; name: string; args: string[] };

export const MAX_INPUT_LENGTH = 1000;

/** Words, quotes and escapes only. No interpolation, pipelines or execution. */
export function parseCommand(input: string): ParseResult {
  if (input.length > MAX_INPUT_LENGTH) return { kind: 'error', message: `命令不能超过 ${MAX_INPUT_LENGTH} 个字符。` };
  const words: string[] = [];
  let word = '';
  let started = false;
  let quote: '"' | "'" | undefined;
  let escaping = false;
  for (const char of input) {
    if (escaping) { word += char; started = true; escaping = false; continue; }
    if (char === '\\' && quote !== "'") { escaping = true; started = true; continue; }
    if (quote) {
      if (char === quote) quote = undefined;
      else word += char;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; started = true; continue; }
    if (/\s/u.test(char)) {
      if (started) { words.push(word); word = ''; started = false; }
      continue;
    }
    if (';|&<>`'.includes(char)) return { kind: 'error', message: '这里只支持单条博客导航命令，不支持 shell 运算符。' };
    word += char;
    started = true;
  }
  if (quote) return { kind: 'error', message: '引号未闭合。' };
  if (escaping) return { kind: 'error', message: '反斜杠后缺少字符。' };
  if (started) words.push(word);
  if (words.length === 0) return { kind: 'empty' };
  return { kind: 'command', name: words[0]!, args: words.slice(1) };
}
