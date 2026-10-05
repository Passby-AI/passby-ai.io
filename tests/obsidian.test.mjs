import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { syncVault } from '../scripts/obsidian/sync.ts';
import { transformMarkdown } from '../scripts/obsidian/markdown.ts';
import publishedUrls from '../scripts/published-urls.mjs';

const note = (body = 'Hello', fields = '') => `---\ntitle: Test\nstatus: archived\ncreated: 2026-09-16 20:30:00\n${fields}---\n${body}\n`;
async function fixture(t) {
  const temp = await mkdtemp(path.join(tmpdir(), 'blog-sync-'));
  t.after(async () => {
    assert.ok(temp.startsWith(path.join(tmpdir(), 'blog-sync-')));
    await rm(temp, { recursive: true, force: true });
  });
  const root = path.join(temp, 'blog');
  const vault = path.join(temp, 'vault');
  await mkdir(root); await mkdir(vault);
  async function put(file, text, base = vault) { await mkdir(path.dirname(path.join(base, file)), { recursive: true }); await writeFile(path.join(base, file), text); }
  return { root, vault, put, run: (options = {}) => syncVault({ root, vault, ...options }),
    generated: (slug) => readFile(path.join(root, `src/content/posts/obsidian/${slug}.md`), 'utf8') };
}

test('sync selects archived non-drafts, normalizes metadata, never changes vault, and is idempotent', async (t) => {
  const f = await fixture(t);
  const source = note('[[Second|跳转]] ![[附件.png]]', 'aliases: [别名]\n');
  await f.put('Folder/First.md', source);
  await f.put('Second.md', note('目标词', 'slug: stable\n'));
  await f.put('private.md', note().replace('status: archived', 'status: personal'));
  await f.put('draft.md', note('', 'draft: true\n'));
  await f.put('附件.png', Buffer.from([0, 1, 2]));
  const report = await f.run({ strict: true });
  assert.deepEqual(report, { notes: 2, assets: 1, warnings: [], dryRun: false });
  assert.equal(await readFile(path.join(f.vault, 'Folder/First.md'), 'utf8'), source);
  const first = await f.generated('first');
  assert.match(first, /2026-09-16T12:30:00/);
  assert.match(first, /blog:\/posts\/stable\//);
  assert.match(first, /blog:\/published-assets\/[a-f0-9]{64}\.png/);
  const target = path.join(f.root, 'src/content/posts/obsidian/first.md');
  const before = (await stat(target)).mtimeMs;
  await f.run();
  assert.equal(await f.generated('first'), first);
  assert.equal((await stat(target)).mtimeMs, before);
  assert.deepEqual((await readdir(path.dirname(target))).sort(), ['first.md', 'manifest.json', 'stable.md']);
});

test('ambiguous/missing/private/unsupported references warn with source; strict mode writes nothing', async (t) => {
  const f = await fixture(t);
  await f.put('post.md', note('![[same.png]] [[missing]] [[private]] ![[other]] [[other#^block]]'));
  await f.put('a/same.png', 'a'); await f.put('b/same.png', 'b');
  await f.put('private.md', 'private note'); await f.put('other.md', note());
  await assert.rejects(f.run({ strict: true }), /post.md: Ambiguous/);
  assert.deepEqual(await readdir(f.root), []);
  const result = await f.run();
  for (const word of ['Ambiguous', 'Missing', 'unpublished', 'transclusion', 'block']) assert.ok(result.warnings.some((warning) => warning.includes(word)));
  assert.match(await f.generated('post'), /same\.png/);
});

test('relative links, reference-style attachments, aliases and headings resolve deterministically', async (t) => {
  const f = await fixture(t);
  await f.put('folder/start.md', note('[go](../target.md#Hello%20World) ![pic][asset]\n\n[asset]: ../media/a%20b.png\n\n[[Alias]] [[target#中文 标题]]'));
  await f.put('target.md', note('# Hello World\n\n## 中文 标题', 'aliases: [Alias]\n'));
  await f.put('media/a b.png', 'pixels');
  await f.run({ strict: true });
  const text = await f.generated('start');
  assert.match(text, /blog:\/posts\/target\/#hello-world/);
  assert.match(text, /blog:\/published-assets/);
  assert.match(text, /\[Alias\]\(blog:\/posts\/target\/\)/);
});

test('duplicate slugs and invalid metadata fail before touching previous generated files', async (t) => {
  const f = await fixture(t);
  await f.put('one.md', note()); await f.run();
  const before = await f.generated('one');
  await f.put('nested/one.md', note());
  await assert.rejects(f.run(), /Duplicate slug.*one.md.*nested\/one.md|Duplicate slug.*nested\/one.md.*one.md/);
  assert.equal(await f.generated('one'), before);
  await f.put('nested/one.md', note('', 'slug: unique\n').replace('2026-09-16', '2026-02-30'));
  await assert.rejects(f.run(), /nested\/one.md/);
  await f.put('nested/one.md', '---\ntags: [archived\n---\n');
  await assert.rejects(f.run(), /nested\/one.md/);
});

test('manual post collisions and unmanaged outputs are never overwritten', async (t) => {
  const f = await fixture(t);
  await f.put('same.md', note());
  await f.put('src/content/posts/same.md', note(), f.root);
  await assert.rejects(f.run(), /Duplicate slug/);
  await f.put('same.md', note('', 'slug: different\n'));
  await f.put('src/content/posts/obsidian/different.md', note(), f.root);
  await assert.rejects(f.run(), /unmanaged/);
});

test('withdrawn notes/assets are pruned; manually edited generated files block sync; dry-run is read-only', async (t) => {
  const f = await fixture(t);
  await f.put('one.md', note('![[image.png]]')); await f.put('image.png', 'pixels');
  await f.run({ dryRun: true });
  assert.deepEqual(await readdir(f.root), []);
  await f.run();
  const original = await f.generated('one');
  await f.put('src/content/posts/obsidian/one.md', original + 'edit', f.root);
  await assert.rejects(f.run(), /edited locally/);
  await f.put('src/content/posts/obsidian/one.md', original, f.root);
  await f.put('one.md', note().replace('archived', 'private'));
  await f.run();
  assert.deepEqual(await readdir(path.join(f.root, 'src/content/posts/obsidian')), ['manifest.json']);
  assert.deepEqual(await readdir(path.join(f.root, 'public/published-assets')), []);
});

test('selection is configurable and overlapping source/output is rejected', async (t) => {
  const f = await fixture(t);
  await f.put('one.md', note().replace('archived', 'publish'));
  assert.equal((await f.run({ publishStatus: 'publish' })).notes, 1);
  await assert.rejects(syncVault({ root: f.root, vault: f.root }), /overlap/);
});

test('transform preserves code and escaped wiki syntax; generated URLs adapt to both deployment bases', () => {
  const source = '`[[code]]`\n\n```md\n![[code.png]]\n```\n\n\\[\\[escaped]]\n\n[[real]]';
  const seen = [];
  const body = transformMarkdown(source, (target) => { seen.push(target); return { url: 'blog:/posts/real/', image: false }; }, () => {});
  assert.deepEqual(seen, ['real']);
  assert.match(body, /`\[\[code\]\]`/);
  for (const base of ['/', '/terminal_blog/']) {
    const node = { type: 'link', url: 'blog:/posts/real/' };
    publishedUrls({ base }).link(node, { setProperty: (node, key, value) => { node[key] = value; } });
    assert.equal(node.url, `${base}posts/real/`);
  }
});

test('nested status-selected month posts preserve source precision and ignore archived tags', async (t) => {
  const f = await fixture(t);
  const source = '---\ntitle: 从实现一个Vector3f向量类，深入了解运算符重载\ndate: 2026-2\ncategories: [C++, 计算机图形学]\ntags: [cpp, vector3f]\nstatus: archived\n---\nBody\n';
  await f.put('技术/图形学/vector.md', source);
  await f.put('tag-only.md', note().replace('status: archived', 'tags: archived'));
  await f.put('wrong-status.md', note().replace('status: archived', 'status: draft\ntags: archived'));
  await f.put('draft.md', note('', 'draft: true\n'));
  const report = await f.run({ strict: true });
  assert.equal(report.notes, 1);
  const generated = await f.generated('vector');
  assert.match(generated, /created: [\x22\x27]?2026-02[\x22\x27]?\n/);
  assert.ok(!generated.includes('2026-02-01'));
  assert.equal(await readFile(path.join(f.vault, '技术/图形学/vector.md'), 'utf8'), source);
  await f.run({ strict: true });
  assert.equal(await f.generated('vector'), generated);
});
