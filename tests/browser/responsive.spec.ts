import { expect, test, type Locator, type Page } from '@playwright/test';

const mobileViewports = [
  { width: 320, height: 640 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth, `document overflowed at ${dimensions.clientWidth}px`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function visibleLogoVariants(page: Page) {
  return page.locator('[data-logo-variant]').evaluateAll((variants) => variants.filter((variant) => {
    const style = getComputedStyle(variant);
    const box = variant.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
  }).map((variant) => variant.getAttribute('data-logo-variant')));
}

async function firstPostLink(sidebar: Locator) {
  const links = sidebar.locator('a[href*="/posts/"]');
  for (let index = 0; index < await links.count(); index += 1) {
    const link = links.nth(index);
    const pathname = new URL((await link.getAttribute('href')) ?? '/', 'http://example.test').pathname;
    if (!pathname.endsWith('/posts/') && await link.isVisible()) return link;
  }
  throw new Error('The shared sidebar tree did not expose a post route.');
}

for (const viewport of mobileViewports) {
  test.describe(`mobile ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('drawer, tree, focus and logo remain usable', async ({ page }) => {
      await page.goto('/');
      await expectNoHorizontalOverflow(page);
      expect(await visibleLogoVariants(page)).toHaveLength(1);

      const opener = page.locator('[data-sidebar-open]');
      const sidebar = page.locator('[data-sidebar]');
      await expect(opener).toBeVisible();
      await expect(opener).toHaveAttribute('aria-expanded', 'false');
      await expect(sidebar).toBeHidden();

      await opener.click();
      await expect(page.locator('html')).toHaveAttribute('data-sidebar-state', 'open');
      await expect(opener).toHaveAttribute('aria-expanded', 'true');
      await expect(sidebar).toBeVisible();
      await expect(sidebar.locator('.tree-children').first()).toBeVisible();

      await expect.poll(async () => (await sidebar.boundingBox())?.x ?? Number.NEGATIVE_INFINITY, {
        message: 'drawer should finish entering the viewport',
      }).toBeGreaterThanOrEqual(-1);
      const box = await sidebar.boundingBox();
      expect(box, 'open drawer must have geometry').not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      await expectNoHorizontalOverflow(page);

      await page.keyboard.press('Escape');
      await expect(page.locator('html')).not.toHaveAttribute('data-sidebar-state', 'open');
      await expect(opener).toBeFocused();
      await expect(sidebar).toBeHidden();

      await opener.click();
      await expect.poll(async () => (await sidebar.boundingBox())?.x ?? Number.NEGATIVE_INFINITY, {
        message: 'reopened drawer should finish entering the viewport',
      }).toBeGreaterThanOrEqual(-1);
      for (let depth = 0; depth < 10; depth += 1) {
        const nextDirectory = sidebar.locator('details:not([open]) > summary:visible').first();
        if (await nextDirectory.count() === 0) break;
        await nextDirectory.click();
      }
      const postLink = await firstPostLink(sidebar);
      await postLink.click();
      await expect(page.locator('[data-sidebar-open]')).toBeVisible();
      await page.locator('[data-sidebar-open]').click();
      const active = page.locator('[data-sidebar] a[aria-current="page"]');
      await expect(active).toBeVisible();
      await expect(active.locator('xpath=ancestor::details[not(@open)]')).toHaveCount(0);

      await expectNoHorizontalOverflow(page);
    });
  });
}

test.describe('desktop 1280x800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const theme of ['light', 'dark'] as const) {
    test(`keeps the split layout and one readable logo in ${theme} mode`, async ({ page }) => {
      await page.goto('/');
      await page.locator('[data-theme-control]').selectOption(theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const sidebar = page.locator('[data-sidebar]');
      const editor = page.locator('.editor');
      await expect(sidebar).toBeVisible();
      await expect(page.locator('[data-sidebar-open]')).toBeHidden();
      const sidebarBox = await sidebar.boundingBox();
      const editorBox = await editor.boundingBox();
      expect(sidebarBox).not.toBeNull();
      expect(editorBox).not.toBeNull();
      expect(editorBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x + sidebarBox!.width - 1);
      expect(await visibleLogoVariants(page)).toHaveLength(1);
      await expectNoHorizontalOverflow(page);
    });
  }
});
