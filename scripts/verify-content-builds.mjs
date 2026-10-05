import assert from 'node:assert/strict';
import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixture = resolve('src/content/posts/__build-verification.md');
assert.ok(!existsSync(fixture), `Refusing to overwrite ${fixture}`);
const cli = resolve('node_modules/astro/bin/astro.mjs');
const outputDir = '.astro/content-verification';
const content = (fields) => `---\ntitle: Verification fixture\ncreated: "2026-09-15 12:00:00"\n${fields}\n---\nTemporary verification body.\n`;
function build() {
  return spawnSync(process.execPath, [cli, 'build', '--outDir', outputDir], { encoding: 'utf8', timeout: 120000 });
}
try {
  writeFileSync(fixture, content('slug: learning-backtracking'));
  let result = build();
  assert.notEqual(result.status, 0, 'Duplicate slug should fail build');
  assert.match(result.stdout + result.stderr, /Duplicate slug.*learning-backtracking/);
  assert.match(result.stdout + result.stderr, /__build-verification\.md/);
  console.log('PASS: duplicate slug fails build with source path');

  writeFileSync(fixture, content('').replace('"2026-09-15 12:00:00"', '2026-02-30'));
  result = build();
  assert.notEqual(result.status, 0, 'Invalid date should fail build');
  assert.match(result.stdout + result.stderr, /Invalid calendar date/);
  assert.match(result.stdout + result.stderr, /__build-verification/);
  console.log('PASS: invalid unquoted date fails build with source path');

  writeFileSync(fixture, content('slug: verification-draft\ndraft: true'));
  result = build();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(!existsSync(resolve(outputDir, 'posts/verification-draft/index.html')));
  for (const path of ['index.html', 'posts/index.html', 'about/index.html']) {
    assert.ok(!readFileSync(resolve(outputDir, path), 'utf8').includes('Verification fixture'), `${path} exposes draft`);
  }
  console.log('PASS: draft excluded from generated routes and navigation');
} finally {
  // Only this script's exclusively-created file is removed; authored files stay untouched.
  if (existsSync(fixture)) unlinkSync(fixture);
}
