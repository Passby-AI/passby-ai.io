import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
function deploymentBase() {
  if (process.env.BASE_PATH !== undefined) return process.env.BASE_PATH;
  const [owner, repository] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  if (!owner || !repository || repository.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/';
  return `/${repository}/`;
}
const base = `/${(process.argv[3] ?? deploymentBase()).replace(/^\/+|\/+$/g, '')}/`.replace('//', '/');
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const files = walk(root);
let links = 0;
function verifyUrl(url, from) {
  if (/^(?:https?:|data:|mailto:|#)/.test(url)) return;
  const sourcePath = relative(root, from).split(sep).join('/');
  const resolved = new URL(url, `https://blog.example${base}${sourcePath}`);
  assert.ok(resolved.pathname.startsWith(base), `${from}: URL escapes base: ${url}`);
  const target = resolve(root, decodeURIComponent(resolved.pathname.slice(base.length)));
  assert.ok(target === root || target.startsWith(root + sep), `Invalid asset path: ${url}`);
  assert.ok(existsSync(target), `${from}: missing ${url}`);
  if (statSync(target).isDirectory()) assert.ok(existsSync(join(target, 'index.html')), `Missing index for ${url}`);
  links++;
}
for (const file of files) {
  if (file.endsWith('.html')) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) verifyUrl(match[1], file);
    assert.ok(html.includes('id="content"'), `${file}: missing main region`);
    assert.ok(html.includes('data-theme-control'), `${file}: missing theme control`);
    assert.ok(html.includes('id="terminal-panel"') && html.includes('for="terminal-input"'), `${file}: missing labelled terminal`);
    assert.ok(html.includes('data-terminal-toggle') && html.includes('aria-controls="terminal-panel"'), `${file}: missing terminal trigger`);
    const navigationMatch = /<script\b(?=[^>]*id="blog-navigation")[^>]*>([\s\S]*?)<\/script>/.exec(html);
    assert.ok(navigationMatch, `${file}: missing shared navigation data`);
    const navigation = JSON.parse(navigationMatch[1]);
    const sidebar = /<nav\b(?=[^>]*aria-label="文件导航")[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1];
    assert.ok(sidebar, `${file}: missing sidebar navigation`);
    function verifyNode(node) {
      if (node.route) {
        verifyUrl(node.route, file);
        assert.ok(sidebar.includes(`href="${node.route}"`), `${file}: terminal destination ${node.route} missing from sidebar`);
      }
      node.children?.forEach(verifyNode);
    }
    verifyNode(navigation);
    assert.ok(!html.includes('data-astro-transition'), 'Unexpected SPA routing dependency');
  }
  if (file.endsWith('.css')) {
    const css = readFileSync(file, 'utf8');
    assert.ok(!css.includes('data:font/'), 'Font subsets must stay external');
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) verifyUrl(match[1], file);
  }
}
const articlePath = files.find((file) => file.endsWith('.html') && file.includes(`${sep}posts${sep}`) && !file.endsWith(`${sep}posts${sep}index.html`));
assert.ok(articlePath, 'Missing generated article page');
const article = readFileSync(articlePath, 'utf8');
const homepage = readFileSync(join(root, 'index.html'), 'utf8');
const recentSection = /<section\b(?=[^>]*aria-labelledby="recent-heading")[^>]*>([\s\S]*?)<\/section>/.exec(homepage)?.[1];
assert.ok(recentSection, 'Missing homepage recent-post dashboard');
const dates = [...recentSection.matchAll(/datetime="([^"]+)"/g)].map((match) => Date.parse(match[1]));
assert.ok(dates.length > 0 && dates.length <= 5 && dates.every((date) => Number.isFinite(date)), 'Missing/invalid recent dates');
assert.ok(dates.every((date, index) => index === 0 || dates[index - 1] >= date), 'Recent posts are not sorted newest first');
assert.ok(homepage.includes('data-terminal-command="help"'), 'Missing terminal navigation hint');
assert.ok(article.includes('astro-code') && article.includes('--shiki-dark') && article.includes('--shiki-light'), 'Missing dual-theme code highlighting');
assert.ok(article.includes('class="prose"'), 'Missing prose font scope');
assert.ok(!existsSync(join(root, 'projects')), 'Placeholder project route should not exist');
assert.ok(!existsSync(join(root, 'notes')), 'Placeholder notes route should not exist');
assert.ok(files.some((file) => file.endsWith('.woff2')), 'Missing local fonts');
assert.ok(existsSync(join(root, 'search/index.html')), 'Missing GUI search page');
assert.ok(existsSync(join(root, 'pagefind/pagefind.js')), 'Missing Pagefind runtime');
const searchMetadata = JSON.parse(readFileSync(join(root, 'pagefind/pagefind-entry.json'), 'utf8'));
assert.ok(Object.values(searchMetadata.languages).some((language) => language.page_count > 0), 'Missing published search index');
console.log(`Verified ${files.filter((file) => file.endsWith('.html')).length} pages and ${links} links/assets at base ${base}`);
