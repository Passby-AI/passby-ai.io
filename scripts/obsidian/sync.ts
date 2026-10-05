import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir, lstat, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { parse, stringify } from 'yaml';
import { entrySchema, deriveSlug, dateAttribute, type BlogEntry } from '../../src/lib/content-model.ts';
import { postRoute } from '../../src/lib/routes.ts';
import { transformMarkdown, headingFragment } from './markdown.ts';

const CONTENT = 'src/content/posts/obsidian';
const ASSETS = 'public/published-assets';
const MANIFEST = `${CONTENT}/manifest.json`;
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const posix = (value: string) => value.replaceAll('\\', '/');
const inside = (parent: string, child: string) => child === parent || child.startsWith(parent + path.sep);

export interface SyncOptions { vault: string; root: string; publishStatus?: string; strict?: boolean; dryRun?: boolean }
interface Note { source: string; body: string; raw: Record<string, unknown>; data?: BlogEntry }

export function parseNote(source: string, text: string): Note {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) {
    if (/^\uFEFF?---(?:\r?\n|$)/.test(text)) throw new Error(`${source}: unclosed frontmatter`);
    return { source, body: text, raw: {} };
  }
  try {
    const raw: unknown = parse(match[1]!, { schema: 'core' });
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('frontmatter must be a YAML mapping');
    return { source, body: text.slice(match[0].length), raw: raw as Record<string, unknown> };
  } catch (error) { throw new Error(`${source}: ${(error as Error).message}`); }
}

async function filesIn(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const relative = posix(path.join(directory, entry.name));
      if (entry.isSymbolicLink()) continue; // Never follow a vault link outside the selected source.
      if (entry.isDirectory()) await walk(relative);
      else if (entry.isFile()) files.push(relative);
    }
  }
  try { await walk(''); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return files.sort();
}

async function optionalRead(file: string) {
  try { return await readFile(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

/** Refuse symlinks at every output ancestor before writing or removing anything. */
async function safeOutput(root: string, relative: string) {
  const target = path.resolve(root, relative);
  if (!inside(root, target) || target === root) throw new Error(`Unsafe output path: ${relative}`);
  let current = root;
  for (const segment of path.relative(root, target).split(path.sep)) {
    current = path.join(current, segment);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`Refusing symlink output: ${relative}`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return target;
}

export async function syncVault(options: SyncOptions) {
  const root = await realpath(options.root);
  const vault = await realpath(options.vault);
  if (inside(vault, root) || inside(root, vault)) throw new Error('Vault and blog repository must not overlap. Use an external read-only vault.');
  const publishStatus = options.publishStatus ?? 'archived';
  if (typeof publishStatus !== 'string' || !publishStatus.trim()) throw new Error('publishStatus must be a non-empty string');
  const sources = await filesIn(vault);
  const notes = await Promise.all(sources.filter((file) => /\.md$/i.test(file)).map(async (source) =>
    parseNote(source, await readFile(path.join(vault, source), 'utf8'))));
  const warnings: string[] = [];
  const selected: Note[] = [];
  for (const note of notes) {
    if (note.raw.status !== publishStatus) continue;
    try {
      const data = entrySchema.parse(note.raw);
      note.data = { ...data, slug: deriveSlug(note.source, data.slug) };
      if (!data.draft) selected.push(note);
    } catch (error) { throw new Error(`${note.source}: ${(error as Error).message}`); }
  }

  // Catch collisions with manually authored posts before emitting any file.
  const slugs = new Map<string, string>();
  for (const file of await filesIn(path.join(root, 'src/content/posts'))) {
    if (!/\.md$/i.test(file) || file.startsWith('obsidian/')) continue;
    const note = parseNote(file, await readFile(path.join(root, 'src/content/posts', file), 'utf8'));
    const slug = deriveSlug(file, entrySchema.parse(note.raw).slug);
    slugs.set(slug.toLowerCase(), `src/content/posts/${file}`);
  }
  for (const note of selected) {
    const key = note.data!.slug.toLowerCase();
    if (slugs.has(key)) throw new Error(`Duplicate slug "${key}": ${slugs.get(key)} and ${note.source}`);
    slugs.set(key, note.source);
  }

  const output = new Map<string, Buffer>();
  const selectedBySource = new Map(selected.map((note) => [note.source, note]));
  const assets = new Map<string, { file: string; bytes: Buffer }>();
  const assetExtensions = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|pdf|mp3|wav|ogg|mp4|webm|zip|txt)$/i;
  for (const note of selected) {
    const warn = (message: string) => warnings.push(`${note.source}: ${message}`);
    const referenced = new Set<string>();
    // Discover references first; the transformer remains synchronous and independent of disk I/O.
    const resolveReference = (input: string, embed: boolean) => {
      let decoded: string;
      try { decoded = decodeURIComponent(input); } catch { warn(`Invalid URL encoding: ${input}`); return; }
      const [target = '', fragment = ''] = decoded.split('#', 2);
      if (fragment.startsWith('^')) { warn(`Unsupported block reference: ${input}`); return; }
      const clean = posix(target);
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(note.source), clean));
      const exact = (value: string) => sources.filter((source) => source === value || source === `${value}.md`);
      let matches = !target ? [note.source] : exact(relative);
      if (!matches.length) matches = exact(clean.replace(/^\//, ''));
      if (!matches.length) matches = sources.filter((source) => source.endsWith(`/${clean}`) || source.endsWith(`/${clean}.md`) ||
        path.posix.basename(source) === clean || path.posix.basename(source, '.md') === clean);
      if (!matches.length) matches = notes.filter((candidate) => {
        const aliases = candidate.raw.aliases;
        return (Array.isArray(aliases) ? aliases : [aliases]).includes(target);
      }).map((candidate) => candidate.source);
      if (matches.length !== 1) { warn(`${matches.length ? 'Ambiguous' : 'Missing'} reference "${input}"${matches.length ? `: ${matches.join(', ')}` : ''}`); return; }
      const source = matches[0]!;
      if (/\.md$/i.test(source)) {
        const published = selectedBySource.get(source);
        if (!published) { warn(`Reference to unpublished note: ${input}`); return; }
        if (embed) { warn(`Note transclusion is unsupported and preserved: ${input}`); return; }
        return { url: `blog:${postRoute(published.data!.slug, '/')}${headingFragment(fragment)}`, image: false };
      }
      if (!assetExtensions.test(source)) { warn(`Unsupported attachment type: ${input}`); return; }
      referenced.add(source);
      const asset = assets.get(source);
      return { url: asset ? `blog:/published-assets/${asset.file}${fragment ? `#${encodeURIComponent(fragment)}` : ''}` : 'asset:pending', image: /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(source) };
    };
    transformMarkdown(note.body, resolveReference, () => {});
    for (const source of referenced) {
      const bytes = await readFile(path.join(vault, source));
      assets.set(source, { file: `${hash(bytes)}${path.extname(source).toLowerCase()}`, bytes });
    }
    const transformed = transformMarkdown(note.body, resolveReference, warn);
    const { createdPrecision, updatedPrecision, ...data } = note.data!;
    const metadata = { ...data, status: publishStatus, created: dateAttribute(data.created, createdPrecision),
      updated: data.updated ? dateAttribute(data.updated, updatedPrecision) : undefined };
    output.set(`${CONTENT}/${data.slug}.md`, Buffer.from(`---\n${stringify(metadata, { lineWidth: 0 })}---\n${transformed}`));
  }
  for (const asset of assets.values()) output.set(`${ASSETS}/${asset.file}`, asset.bytes);
  const uniqueWarnings = [...new Set(warnings)];
  if (options.strict && uniqueWarnings.length) throw new Error(`Sync warnings (strict mode):\n${uniqueWarnings.join('\n')}`);

  const manifestPath = await safeOutput(root, MANIFEST);
  const previous = await optionalRead(manifestPath);
  const previousManifest = previous ? JSON.parse(previous.toString()) : { version: 1, files: {} };
  if (previousManifest?.version !== 1) throw new Error('Unsupported sync manifest version');
  const old: Record<string, string> = previousManifest.files;
  if (!old || typeof old !== 'object' || Array.isArray(old)) throw new Error('Invalid sync manifest');
  for (const [file, checksum] of Object.entries(old)) {
    if (!new RegExp(`^(?:${CONTENT}/[^/]+\\.md|${ASSETS}/[a-f0-9]+\\.[a-z0-9]+)$`).test(file) || !/^[a-f0-9]{64}$/.test(checksum)) throw new Error('Invalid sync manifest entry');
    const existing = await optionalRead(await safeOutput(root, file));
    if (existing && hash(existing) !== checksum) throw new Error(`${file}: generated file was edited locally; move your changes before syncing`);
  }
  for (const file of output.keys()) {
    const existing = await optionalRead(await safeOutput(root, file));
    if (existing && !old[file]) throw new Error(`${file}: refusing to overwrite an unmanaged file`);
  }
  // A reserved directory must never hide manually added content from collision checks.
  for (const file of await filesIn(path.join(root, CONTENT))) {
    if (file !== 'manifest.json' && !old[`${CONTENT}/${file}`]) throw new Error(`${CONTENT}/${file}: unmanaged file in sync directory`);
  }
  const manifest = { version: 1, files: Object.fromEntries([...output].sort(([a], [b]) => a < b ? -1 : 1).map(([file, bytes]) => [file, hash(bytes)])) };
  if (!options.dryRun) {
    for (const [file, bytes] of output) {
      const destination = await safeOutput(root, file);
      if ((await optionalRead(destination))?.equals(bytes)) continue;
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
    for (const file of Object.keys(old)) if (!output.has(file)) {
      const destination = await safeOutput(root, file);
      if (await optionalRead(destination)) await unlink(destination);
    }
    await mkdir(path.dirname(manifestPath), { recursive: true });
    const serialized = JSON.stringify(manifest, null, 2) + '\n';
    if (previous?.toString() !== serialized) await writeFile(manifestPath, serialized);
  }
  return { notes: selected.length, assets: assets.size, warnings: uniqueWarnings, dryRun: !!options.dryRun };
}
