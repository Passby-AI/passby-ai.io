import test from 'node:test';
import assert from 'node:assert/strict';
import { entrySchema, deriveSlug, parseContentDate, publishedEntries, formatDateTime, dateAttribute } from '../src/lib/content-model.ts';
import { restoreDateStrings } from '../src/lib/frontmatter.ts';
import { homeRoute, postsRoute, postRoute, pageRoute, isCurrentRoute, assertPageRoute } from '../src/lib/routes.ts';
import { buildNavigation } from '../src/lib/navigation-model.ts';

const data = (overrides = {}) => entrySchema.parse({ title: '标题', created: '2026-09-11 20:30:00', ...overrides });

test('Obsidian null, scalar and list metadata normalize without requiring blog fields', () => {
  const entry = data({ tags: null, type: null, categories: '编程', aliases: ['旧标题', '旧标题'] });
  assert.deepEqual(entry.tags, []);
  assert.deepEqual(entry.categories, ['编程']);
  assert.deepEqual(entry.aliases, ['旧标题']);
  assert.equal(entry.type, undefined);
  assert.equal(entry.draft, false);
});

test('required metadata and malformed lists fail clearly', () => {
  for (const overrides of [{ title: '' }, { created: undefined }, { tags: [42] }, { draft: 'false' }, { slug: '' }]) {
    assert.throws(() => data(overrides));
  }
});

test('dates are timezone-independent and reject normalized-overflow dates', () => {
  assert.equal(parseContentDate('2026-09-11 20:30:00').toISOString(), '2026-09-11T12:30:00.000Z');
  assert.equal(parseContentDate('2026-09-11T20:30:00Z').toISOString(), '2026-09-11T20:30:00.000Z');
  assert.equal(formatDateTime(parseContentDate('2026-09-11 20:30:00')), '2026-09-11 20:30');
  for (const value of ['2026-02-30', '2025-02-29', '2026-09-11 24:00:00', '2026-09-11 12:60:00', '', null, false]) {
    assert.throws(() => parseContentDate(value), String(value));
  }
  assert.doesNotThrow(() => parseContentDate('2024-02-29'));
});

test('quoted and unquoted YAML dates retain wall time and explicit offsets', () => {
  for (const value of ['2026-09-11 20:30:00', '"2026-09-11 20:30:00"', '2026-09-11T20:30:00+08:00']) {
    const restored = restoreDateStrings(`---\ncreated: ${value}\n---\nBody`, { created: new Date(), title: '标题' });
    assert.equal(entrySchema.parse(restored).created.toISOString(), '2026-09-11T12:30:00.000Z');
  }
  assert.throws(() => entrySchema.parse(restoreDateStrings('---\ncreated: 2026-02-30\n---\n', { title: '标题' })));
});

test('slugs use filenames, support Unicode and explicit overrides, and reject traversal', () => {
  assert.equal(deriveSlug('nested/My Note.md'), 'my-note');
  assert.equal(deriveSlug('notes\\旋转.md'), '旋转');
  assert.equal(deriveSlug('anything.md', 'stable-url'), 'stable-url');
  for (const value of ['../secret', 'a/b', 'a?b', 'a#b', 'a%2Fb', '']) assert.throws(() => deriveSlug('ok.md', value));
  const first = publishedEntries([{ id: 'same.md', data: data() }]);
  const renamed = publishedEntries([{ id: 'same.md', data: data({ title: '新标题' }) }]);
  assert.equal(first[0].data.slug, renamed[0].data.slug);
});

test('duplicate slugs identify both source files, including drafts and case collisions', () => {
  assert.throws(() => publishedEntries([
    { id: 'a/note.md', data: data(), filePath: 'a/note.md' },
    { id: 'b/note.md', data: data({ draft: true }), filePath: 'b/note.md' },
  ]), /Duplicate slug.*a\/note\.md.*b\/note\.md/);
  assert.throws(() => publishedEntries([{ id: 'a.md', data: data({ slug: 'Hello' }) }, { id: 'b.md', data: data({ slug: 'hello' }) }]));
});

test('publication excludes drafts and provides stable ordering on equal dates', () => {
  const posts = publishedEntries([
    { id: 'z.md', data: data() },
    { id: 'draft.md', data: data({ draft: true }) },
    { id: 'a.md', data: data() },
    { id: 'new.md', data: data({ created: '2026-09-12' }) },
  ]);
  assert.deepEqual(posts.map((post) => post.data.slug), ['new', 'a', 'z']);
});

test('all canonical routes work at root and project Pages bases', () => {
  for (const base of ['/', '/terminal_blog/', '/terminal_blog']) {
    const root = base === '/' ? '/' : '/terminal_blog/';
    assert.equal(homeRoute(base), root);
    assert.equal(postsRoute(base), `${root}posts/`);
    assert.equal(postRoute('hello', base), `${root}posts/hello/`);
    assert.equal(pageRoute('about', base), `${root}about/`);
    assert.equal(postRoute('中文', base), `${root}posts/%E4%B8%AD%E6%96%87/`);
  }
  assert.equal(isCurrentRoute('/terminal_blog/posts/hello', '/terminal_blog/posts/hello/'), true);
  assert.equal(isCurrentRoute('/terminal_blog/posts/hello/', '/terminal_blog/posts/'), false);
  assert.equal(isCurrentRoute('/posts/中文/', '/posts/%E4%B8%AD%E6%96%87/'), true);
  assert.throws(() => assertPageRoute('posts', 'pages/posts.md'), /collides/);
});

test('categories create virtual directories while article nodes use canonical post routes', () => {
  const root = buildNavigation([
    { data: { slug: 'vector', title: 'Vector', categories: ['C++', '图形学'] } },
    { data: { slug: 'plain', title: 'Plain', categories: [] } },
  ], [], '/blog/');
  const posts = root.children.find((node) => node.name === 'posts/');
  assert.deepEqual(posts.children.map((node) => node.name), ['C++/', 'plain.md']);
  const article = posts.children[0].children[0].children[0];
  assert.equal(article.path, '~/posts/C++/图形学/vector.md');
  assert.equal(article.route, '/blog/posts/vector/');
});

test('date fallback preserves month precision in display and generated frontmatter round trips', () => {
  for (const date of ['2026-2', '2026-02']) {
    const entry = entrySchema.parse({ title: 'Month', date });
    assert.equal(entry.createdPrecision, 'month');
    assert.equal(formatDateTime(entry.created, entry.createdPrecision), '2026年2月');
    assert.equal(dateAttribute(entry.created, entry.createdPrecision), '2026-02');
    const next = entrySchema.parse({ title: 'Month', created: dateAttribute(entry.created, entry.createdPrecision) });
    assert.equal(next.createdPrecision, 'month');
    assert.equal(next.created.getTime(), entry.created.getTime());
  }
  for (const date of ['2026-0', '2026-13', '2026-002', '2026-02-30']) assert.throws(() => entrySchema.parse({ title: 'Invalid', date }));
});

test('created takes priority, date-only has no fabricated time, and updated retains precision', () => {
  const entry = data({ date: '2026-2', updated: '2026-3' });
  assert.equal(entry.createdPrecision, 'time');
  assert.equal(formatDateTime(entry.created, entry.createdPrecision), '2026-09-11 20:30');
  assert.equal(formatDateTime(entry.updated, entry.updatedPrecision), '2026年3月');
  const day = entrySchema.parse(restoreDateStrings('---\ndate: 2026-02-03\n---\n', { title: 'Day', date: new Date() }));
  assert.equal(day.createdPrecision, 'day');
  assert.equal(formatDateTime(day.created, day.createdPrecision), '2026-02-03');
  assert.equal(dateAttribute(day.created, day.createdPrecision), '2026-02-03');
  assert.throws(() => data({ created: 'invalid', date: '2026-2' }));
});

test('month precision sorting remains chronological across year boundaries', () => {
  const make = (id, date) => ({ id, data: entrySchema.parse({ title: id, date }) });
  const entries = publishedEntries([make('feb.md', '2026-2'), make('day.md', '2026-02-15'), make('old.md', '2025-12'), make('march.md', '2026-3')]);
  assert.deepEqual(entries.map((entry) => entry.data.slug), ['march', 'day', 'feb', 'old']);
});

test('filename punctuation normalizes without changing valid slugs; collisions still fail', () => {
  assert.equal(deriveSlug('技术/C++ 多项式类代码详解.md'), 'c-plus-plus-多项式类代码详解');
  assert.equal(deriveSlug('从实现一个Vector3f向量类，深入了解运算符重载.md'), '从实现一个vector3f向量类-深入了解运算符重载');
  assert.equal(deriveSlug('already--valid_name.md'), 'already--valid_name');
  assert.throws(() => deriveSlug('test.md', 'C++'));
  assert.throws(() => publishedEntries([{ id: 'same,name.md', data: data() }, { id: 'same name.md', data: data() }]), /Duplicate slug/);
});
