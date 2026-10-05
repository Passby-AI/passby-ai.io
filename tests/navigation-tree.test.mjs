import test from 'node:test';
import assert from 'node:assert/strict';
import { containsCurrentRoute } from '../src/lib/navigation-tree.ts';

const leaf = {
  name: '非常长的-article-name.md',
  title: '非常长的中英文 mixed article name',
  type: 'post',
  path: '~/posts/graphics/webgl/非常长的-article-name.md',
  route: '/terminal_blog/posts/%E9%9D%9E%E5%B8%B8%E9%95%BF%E7%9A%84-article-name/',
};

const webgl = {
  name: 'webgl/',
  title: 'WebGL',
  type: 'directory',
  path: '~/posts/graphics/webgl',
  children: [leaf],
};

const graphics = {
  name: 'graphics/',
  title: '图形学',
  type: 'directory',
  path: '~/posts/graphics',
  children: [webgl],
};

const posts = {
  name: 'posts/',
  title: '归档',
  type: 'directory',
  path: '~/posts',
  route: '/terminal_blog/posts/',
  children: [graphics],
};

test('current project-Pages route opens every recursive ancestor without mutating the tree', () => {
  const before = structuredClone(posts);
  const pathname = '/terminal_blog/posts/非常长的-article-name/';

  assert.equal(containsCurrentRoute(posts, pathname), true);
  assert.equal(containsCurrentRoute(graphics, pathname), true);
  assert.equal(containsCurrentRoute(webgl, pathname), true);
  assert.equal(containsCurrentRoute(leaf, pathname), true);
  assert.deepEqual(posts, before);
});

test('route matching handles encoded paths and does not treat a shared prefix as current', () => {
  assert.equal(
    containsCurrentRoute(posts, '/terminal_blog/posts/非常长的-article-name'),
    true,
  );
  assert.equal(
    containsCurrentRoute(posts, '/terminal_blog/posts/非常长的-article-name-extra/'),
    false,
  );
  assert.equal(containsCurrentRoute(posts, '/terminal_blog/posts/'), true);
  assert.equal(containsCurrentRoute(graphics, '/terminal_blog/posts/'), false);
});
