import { z } from 'astro/zod';
import { validateSlug } from './slug.ts';
export { validateSlug } from './slug.ts';

const text = z.string().trim().min(1);
const optionalText = z.preprocess((value) => value == null || value === '' ? undefined : value, text.optional());
const stringList = z.preprocess((value) => {
  if (value == null || value === '') return [];
  return typeof value === 'string' ? [value] : value;
}, z.array(text)).transform((values) => [...new Set(values)]);

/** Unzoned Obsidian timestamps are interpreted in Asia/Shanghai, never host time. */
export function parseContentDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string') throw new Error('Expected a date or YYYY-MM-DD HH:mm:ss timestamp');
  const monthOnly = /^(\d{4})-(\d{1,2})$/.exec(value.trim());
  // Month-start is an internal sorting key; display/serialization retain precision.
  if (monthOnly) return parseContentDate(monthOnly[1] + '-' + monthOnly[2]!.padStart(2, '0') + '-01');
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value.trim());
  if (!match) throw new Error('Expected YYYY-MM-DD, YYYY-MM-DD HH:mm:ss, or an ISO timestamp');
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', zone = '+08:00'] = match;
  const calendar = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}Z`);
  if (Number.isNaN(calendar.getTime()) || calendar.getUTCFullYear() !== Number(year) ||
      calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day) ||
      calendar.getUTCHours() !== Number(hour)) throw new Error('Invalid calendar date or time');
  const result = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone}`);
  if (Number.isNaN(result.getTime())) throw new Error('Invalid date or timezone offset');
  return result;
}

const contentDate = z.unknown().transform((value, ctx) => {
  try { return parseContentDate(value); }
  catch (error) {
    ctx.addIssue({ code: 'custom', message: (error as Error).message });
    return z.NEVER;
  }
});

export function deriveSlug(filename: string, explicit?: string): string {
  if (explicit !== undefined) return validateSlug(explicit);
  const name = filename.replaceAll('\\', '/').split('/').at(-1)!.replace(/\.md$/i, '');
  const slug = name.normalize('NFC').toLowerCase()
    .replaceAll('+', '-plus').replaceAll('#', '-sharp')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '');
  return validateSlug(slug);
}

export type DatePrecision = 'month' | 'day' | 'time';
function datePrecision(value: unknown): DatePrecision {
  if (typeof value !== 'string') return 'time';
  if (/^\d{4}-\d{1,2}$/.test(value.trim())) return 'month';
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? 'day' : 'time';
}

export const entrySchema = z.preprocess((value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  const created = raw.created == null || raw.created === '' ? raw.date : raw.created;
  return { ...raw, created, createdPrecision: datePrecision(created), updatedPrecision: datePrecision(raw.updated) };
}, z.object({
  title: text,
  type: optionalText,
  tags: stringList,
  categories: stringList,
  aliases: stringList,
  created: contentDate,
  createdPrecision: z.enum(['month', 'day', 'time']),
  updatedPrecision: z.enum(['month', 'day', 'time']),
  updated: z.preprocess((value) => value == null || value === '' ? undefined : value, contentDate.optional()),
  description: optionalText,
  slug: text.optional().superRefine((value, ctx) => {
    if (value === undefined) return;
    try { validateSlug(value); }
    catch (error) { ctx.addIssue({ code: 'custom', message: (error as Error).message }); }
  }),
  draft: z.boolean().default(false),
}));

export type EntryData = z.infer<typeof entrySchema>;
export type BlogEntry = Omit<EntryData, 'slug'> & { slug: string };

export function normalizeEntries<T extends { id: string; data: EntryData; filePath?: string }>(entries: T[]) {
  const slugs = new Map<string, string>();
  return entries.map((entry) => {
    const source = entry.filePath ?? entry.id;
    let slug: string;
    try { slug = deriveSlug(entry.id, entry.data.slug); }
    catch (error) { throw new Error(`${source}: ${(error as Error).message}`); }
    const previous = slugs.get(slug.toLowerCase());
    if (previous) throw new Error(`Duplicate slug "${slug}": ${previous} and ${source}`);
    slugs.set(slug.toLowerCase(), source);
    return { ...entry, data: { ...entry.data, slug } };
  });
}

export function publishedEntries<T extends { id: string; data: EntryData; filePath?: string }>(entries: T[]) {
  // Validate drafts as well, so a later publication cannot silently replace a route.
  return normalizeEntries(entries).filter((entry) => !entry.data.draft).sort((a, b) =>
    b.data.created.getTime() - a.data.created.getTime() || (a.data.slug < b.data.slug ? -1 : a.data.slug > b.data.slug ? 1 : 0));
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function dateAttribute(date: Date, precision: DatePrecision = 'time'): string {
  if (precision === 'month') return formatDate(date).slice(0, 7);
  if (precision === 'day') return formatDate(date);
  return date.toISOString();
}

export function formatDateTime(date: Date, precision: DatePrecision = 'time'): string {
  if (precision === 'month') {
    const [year, month] = dateAttribute(date, precision).split('-');
    return year + '年' + Number(month) + '月';
  }
  if (precision === 'day') return formatDate(date);
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
