# Mobile responsive remediation task cards

These four cards implement the mobile layout remediation agreed on 2026-10-05.
They share the existing navigation model; no card may introduce a second route
map or a mobile-only content tree.

## Shared contract

- Mobile breakpoint: `48rem`, matching the current application shell.
- The existing `NavigationNode` tree remains the only navigation data source.
- Stable UI hooks:
  - `[data-sidebar]`: the sidebar/drawer element.
  - `[data-sidebar-open]`: mobile button that opens the drawer.
  - `[data-sidebar-close]`: control inside the drawer that closes it.
  - `[data-sidebar-backdrop]`: dismissible mobile backdrop.
  - `html[data-sidebar-state="open"]`: open state exposed to CSS.
  - `[data-logo-variant="wide|compact|text"]`: responsive logo variants.
- Closing the drawer must restore focus to the button that opened it.
- `Escape`, backdrop click, and successful navigation close the mobile drawer.
- Desktop sidebar collapse behavior must remain independent of mobile drawer state.
- Respect `prefers-reduced-motion`; do not add a client framework.

## Task 1 — Mobile sidebar drawer shell

**Branch:** `feature/mobile-sidebar-drawer`

**Owned files:**

- `src/layouts/BaseLayout.astro`
- `src/components/Sidebar.astro`
- optionally a new small controller under `src/scripts/`

**Technical implementation:**

1. Keep the desktop `16rem / content` grid unchanged at widths above `48rem`.
2. Below `48rem`, remove the sidebar from normal document flow and render it as
   a fixed left drawer. Its usable width should be
   `min(20rem, calc(100vw - 3rem))`, and it must not sit beneath the fixed status
   bar.
3. Add a semantic mobile “文件” button to the editor bar. Use the shared data
   hooks above and synchronize `aria-expanded`, `aria-controls`, and accessible
   labels.
4. Add a backdrop and a close control. Close on `Escape`, backdrop click, or a
   sidebar link activation; restore focus to the opener.
5. A closed drawer must not be keyboard reachable. Use `inert` plus visibility
   handling, or an equivalently robust hidden-state implementation.
6. Prevent background scrolling while the drawer is open. Clear mobile-only
   state when crossing back to desktop so resizing cannot leave stale state.
7. Hide the desktop collapse control on mobile. Do not couple its persisted or
   transient state to the drawer.

**Verification:**

- `pnpm check`
- `pnpm test`
- `pnpm build`
- At 320, 375, 390, 430, and 768 px: sidebar does not occupy space above the
  article when closed; drawer is fully visible when open; the page has no
  horizontal overflow.
- Keyboard-only: opener → drawer, `Escape` → closed + focus restored.
- Resize while open from 390 px to desktop and back; the sidebar remains usable
  and ARIA state is accurate.

## Task 2 — Mobile navigation tree

**Branch:** `feature/mobile-navigation-tree`

**Owned files:**

- `src/components/SidebarTree.astro`
- navigation-tree tests if needed

**Technical implementation:**

1. Remove the mobile rule that hides `.tree-children`; the exact same recursive
   tree must render on desktop and in the mobile drawer.
2. Preserve native `<details>/<summary>` disclosure semantics and touch targets.
3. Determine whether a directory contains the current route recursively and
   render that directory open. Do not mutate the shared navigation model.
4. Ensure long Chinese/English filenames wrap without widening the drawer.
5. Give nested levels a restrained indentation and border; avoid horizontal
   tree layouts on mobile.
6. Keep every route sourced from `NavigationNode.route` and the existing route
   helpers.

**Verification:**

- Add a focused test for recursive current-route detection, including a deeply
  nested category and a project-Pages base path.
- At 320 px, expand/collapse directories and activate a nested post using touch
  and keyboard.
- Confirm the active post's ancestor directories are initially open.
- Confirm no filename creates horizontal page overflow.
- `pnpm check && pnpm test && pnpm build` on the branch.

## Task 3 — Responsive ASCII logo variants

**Branch:** `feature/responsive-ascii-logo`

**Owned files:**

- `src/components/dashboard/AsciiLogo.astro`
- `src/components/dashboard/logo.txt`
- new compact logo text asset(s) in the same directory

**Technical implementation:**

1. Keep the current wide logo as source text. Add a deliberately designed
   compact ASCII source of approximately 3–4 rows instead of shrinking the wide
   68-column artwork until it becomes illegible.
2. Render wide, compact, and final text fallback variants with the shared
   `data-logo-variant` hooks. Decorative variants stay `aria-hidden`; the wrapper
   retains the single accessible label `AKIRA'S BLOG`.
3. Use a named inline-size container to choose variants from actual content
   width. Add media-query fallback rules so the text variant remains visible if
   container queries are unavailable.
4. Bound every variant to its container. Horizontal scrolling may be a last
   safety net, but normal target widths must not scroll or clip.
5. Keep the asset static and build-time imported; add no runtime dependency.

**Verification:**

- Visually check 320, 375, 390, 430, 768, and 1024 px in both themes.
- Exactly one visual variant is displayed at each target width.
- No clipping, overlap, unreadably small glyphs, or horizontal page overflow.
- With CSS/container queries disabled, the readable text fallback remains.
- `pnpm check && pnpm test && pnpm build` on the branch.

## Task 4 — Browser responsive acceptance suite

**Branch:** `test/mobile-responsive-e2e`

**Owned files:**

- browser-test configuration
- new responsive browser tests
- `package.json` and `pnpm-lock.yaml` only if a browser test dependency is needed

**Technical implementation:**

1. Add the smallest maintainable real-browser suite appropriate for this Astro
   repository. Reuse an installed Chromium executable when configurable; do not
   add a production dependency.
2. Start the built preview with deterministic host/base settings and test the
   stable data hooks in the shared contract, not generated Astro class names.
3. Cover viewports 320×640, 375×667, 390×844, 430×932, 768×1024, and one desktop
   viewport.
4. Assert document `scrollWidth <= clientWidth`, sidebar closed/open geometry,
   directory visibility, focus restoration after `Escape`, and exactly one
   visible logo variant.
5. Capture screenshots on failure. Include light and dark visual smoke cases,
   without introducing broad brittle snapshots.
6. The test command must be suitable for later GitHub Actions use and must fail
   clearly when the browser executable is unavailable.

**Verification:**

- Demonstrate that at least one assertion fails against the pre-fix baseline.
- After merging Tasks 1–3, run the responsive suite successfully at all target
  viewports.
- Run `pnpm check`, the existing unit suite, production build, build verifier,
  and the new browser suite.

## Integration order

Merge Tasks 1, 2, and 3 into a temporary integration branch in any order,
resolving only shared CSS/markup contracts. Merge Task 4 last, then run:

```text
pnpm check
pnpm test
pnpm build
pnpm verify:build
pnpm <responsive-test-command>
```

Do not merge if the mobile suite passes only by hiding navigation or replacing
the ASCII logo with inaccessible content.
