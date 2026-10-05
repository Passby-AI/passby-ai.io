import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, rm, symlink, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const source = process.cwd();
const temp = await mkdtemp(path.join(tmpdir(), 'blog-publishing-'));
const project = path.join(temp, 'blog');
const vault = path.join(temp, 'vault');
async function run(args, env = {}, succeeds = true) {
  const result = await new Promise((resolve, reject) => {
    const processHandle = spawn(process.execPath, args, { cwd: project, env: { ...process.env, ...env }, windowsHide: true });
    let output = '';
    processHandle.stdout.on('data', (data) => { output += data; });
    processHandle.stderr.on('data', (data) => { output += data; });
    processHandle.on('error', reject);
    processHandle.on('close', (status) => resolve({ status, output }));
  });
  assert.equal(result.status === 0, succeeds, result.output);
  return result.output;
}
try {
  await mkdir(project); await mkdir(vault);
  for (const entry of ['src', 'scripts', 'tests', 'assets', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json', 'pnpm-lock.yaml']) {
    await cp(path.join(source, entry), path.join(project, entry), { recursive: true });
  }
  await symlink(path.join(source, 'node_modules'), path.join(project, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const content = (title, body, fields = '') => `---\ntitle: ${title}\nstatus: archived\ncreated: 2026-01-17 12:00:00\n${fields}---\n${body}\n`;
  const first = content('发布验收示例', 'PublisherNeedle 独特检索词\n\n[[目标笔记#中文 标题|查看目标]] ![[fixture.png]]\n\n| A | B |\n| - | - |\n| one | two |');
  await writeFile(path.join(vault, 'fixture-publisher.md'), first);
  await writeFile(path.join(vault, '目标笔记.md'), content('目标标题', '## 中文 标题\n\n目标正文'));
  await writeFile(path.join(vault, 'private.md'), content('PrivateNeedle', 'PrivateNeedle').replace('archived', 'private'));
  await writeFile(path.join(vault, 'draft.md'), content('DraftNeedle', 'DraftNeedle', 'draft: true\n'));
  await writeFile(path.join(vault, 'fixture.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=', 'base64'));
  await writeFile(path.join(vault, 'month.md'), content('月份精度示例', 'MonthOnlyNeedle').replace('created: 2026-01-17 12:00:00', 'date: 2026-2'));
  await writeFile(path.join(vault, 'tag-only.md'), content('TagOnlyNeedle', 'TagOnlyNeedle').replace('status: archived', 'tags: [archived]'));
  const pnpm = process.env.npm_execpath;
  assert.ok(pnpm, 'Run this verification through pnpm test:publishing');
  await run([pnpm, 'publish:check'], { OBSIDIAN_VAULT: vault });
  console.log('Verified actual pnpm publish:check succeeds in the isolated project.');
  assert.equal(await readFile(path.join(vault, 'fixture-publisher.md'), 'utf8'), first);
  const cli = path.join(source, 'node_modules/astro/bin/astro.mjs');
  for (const base of ['/', '/terminal_blog/']) {
    if (base !== '/') await run([cli, 'build', '--root', project, '--base', base]);
    const html = await readFile(path.join(project, 'dist/posts/fixture-publisher/index.html'), 'utf8');
    assert.ok(!html.includes('blog:/'), 'Adapter URLs were not rewritten');
    assert.ok(html.includes(`${base}posts/${encodeURIComponent('目标笔记')}/#${encodeURIComponent('中文-标题')}`), 'Wrong wiki link/heading destination');
    assert.ok(html.includes(`${base}published-assets/`), 'Missing base-aware attachment');
    assert.ok(html.includes('<table>'), 'GFM table was lost during sync');
    const routes = await readdir(path.join(project, 'dist/posts'));
    assert.ok(!routes.includes('draft') && !routes.includes('private') && !routes.includes('tag-only'));
    for (const page of ['posts/month/index.html', 'posts/index.html', 'index.html']) {
      const markup = await readFile(path.join(project, 'dist', page), 'utf8');
      assert.match(markup, /datetime="2026-02"[^>]*>2026年2月<\/time>/);
      assert.ok(!markup.includes('2026-02-01'), 'Month content must not expose an invented day');
    }
    await run(['scripts/verify-build.mjs', 'dist', base]);
    console.log(await run(['--experimental-strip-types', 'scripts/verify-search.mjs', 'dist', base, 'PublisherNeedle', 'fixture-publisher']));
    console.log(await run(['--experimental-strip-types', 'scripts/verify-search.mjs', 'dist', base, '独特检索词', 'fixture-publisher']));
  }
  // A strict sync failure must short-circuit the actual one-command workflow.
  await writeFile(path.join(vault, 'bad.md'), content('Broken', '[[missing]]'));
  const failure = await run([pnpm, 'publish:check'], { OBSIDIAN_VAULT: vault }, false);
  assert.match(failure, /Missing reference/);
  assert.ok(!failure.includes('> astro check') && !failure.includes('> astro build'), 'Failed sync must stop subsequent checks/build');
  console.log('Verified isolated publishing, source preservation, attachments, tables, draft exclusion and strict failure.');
} finally {
  // Remove the junction first; cleanup may only target the unique temporary fixture.
  try { await rm(path.join(project, 'node_modules'), { force: true, recursive: true }); } catch { /* absent during early failure */ }
  assert.ok(temp.startsWith(path.join(tmpdir(), 'blog-publishing-')));
  await rm(temp, { recursive: true, force: true });
}
