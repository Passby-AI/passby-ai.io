import { parse } from 'yaml';

/** YAML 1.2 keeps timestamps as strings, including their original timezone. */
export function restoreDateStrings(source: string, data: Record<string, unknown>): Record<string, unknown> {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) throw new Error('Could not read Markdown frontmatter');
  const raw = parse(match[1]!, { schema: 'core' }) as Record<string, unknown>;
  return { ...data, created: raw.created, date: raw.date, updated: raw.updated };
}
