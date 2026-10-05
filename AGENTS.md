# Akira's Blog — AGENTS.md

## 0. Purpose

This file defines the product, architecture, implementation constraints, and verification rules for this repository.

The project is a personal blog with a terminal / text-editor / filesystem-inspired interaction model. It should feel like a coherent system rather than a conventional blog with a decorative terminal added on top.

When implementing features, preserve the design principles and architecture in this file unless the user explicitly changes them.

---

## 1. Product Vision

Build a long-term maintainable static personal blog with these core ideas:

- Markdown is the content source.
- Obsidian is the primary writing environment.
- The website adapts to the existing Obsidian content format, not the other way around.
- The UI is terminal-inspired, typography-first, restrained, and keyboard-friendly.
- GUI navigation and terminal navigation are two interfaces over the same content model.
- The homepage is a Neovim-style dashboard rather than a traditional marketing-style hero page.
- The site must be deployable as a static site to GitHub Pages through GitHub Actions.

The project should prioritize:

1. maintainability
2. readability
3. fast static rendering
4. keyboard navigation
5. minimal client-side JavaScript
6. deterministic content publishing
7. GitHub Pages compatibility

Do not turn the project into a generic SaaS dashboard, portfolio template, or visually noisy "cyberpunk terminal" page.

---

## 2. Preferred Technical Stack

Use the following stack unless there is a concrete reason to deviate:

- Framework: Astro
- Language: TypeScript
- Package manager: pnpm
- Content: Astro Content Collections
- Markdown rendering: Astro Markdown pipeline
- Syntax highlighting: Shiki
- Styling: plain CSS / scoped Astro CSS / CSS Modules
- Theme system: CSS custom properties
- Search: Pagefind preferred; Fuse.js is acceptable for small client-side search
- Interactive UI: Astro islands
- Optional island framework: React or Svelte only when native Astro/TypeScript is insufficient
- Obsidian synchronization: Node.js + TypeScript script
- Frontmatter parsing/normalization: Astro content schema and/or gray-matter where needed
- Deployment: GitHub Pages
- CI/CD: GitHub Actions

Avoid introducing a large client framework globally.

Do not use Next.js unless a future requirement genuinely needs server-side features that Astro cannot reasonably provide.

The production website must not depend on a continuously running backend server.

---

## 3. Core Layout

Desktop layout:

```text
┌────────────────┬─────────────────────────────────────────────┐
│                │                                             │
│   NAVIGATION   │                  CONTENT                    │
│                │                                             │
│   ~/           │                                             │
│   posts/       │                                             │
│   projects/    │                                             │
│   notes/       │                                             │
│   about.md     │                                             │
│                │                                             │
├────────────────┴─────────────────────────────────────────────┤
│ terminal, when opened                                        │
└──────────────────────────────────────────────────────────────┘
```

Primary regions:

- left: filesystem-style navigation sidebar
- center: content area
- bottom: collapsible terminal panel

When the terminal opens on desktop, prefer resizing the available content area rather than covering important content with a modal overlay.

On narrow screens, use a responsive fallback. The exact desktop split must not be forced onto mobile.

---

## 4. Homepage / Dashboard

The homepage must first present a Neovim-inspired dashboard.

Required elements:

- ASCII / text-character logo for `AKIRA'S BLOG`
- concise site identity
- recent posts
- publication date/time for recent posts
- clickable post titles
- terminal/navigation hints
- theme-aware styling

Conceptual example:

```text
                 <ASCII AKIRA'S BLOG LOGO>

                        AKIRA'S BLOG

────────────────────────────────────────────────────────

 Recent Posts

 [1] Learning Backtracking                    2026-09-11
 [2] Building My Graphics Tutor               2026-09-08
 [3] Compiling Krita                          2026-07-16

────────────────────────────────────────────────────────

 :posts                 browse posts
 :projects              view projects
 :about                 about
 Ctrl + `               open terminal

────────────────────────────────────────────────────────
```

The ASCII logo should normally be generated once and stored as source text. Do not add a runtime dependency merely to generate the logo in the browser.

Do not build a conventional oversized hero section.

---

## 5. Navigation Model

There are two equivalent navigation interfaces:

1. graphical sidebar
2. terminal

They MUST share the same route/content source of truth.

Do not implement separate duplicated route maps for the sidebar and terminal.

Preferred conceptual architecture:

```text
Content / Virtual FS
        │
        ├── Sidebar
        ├── Terminal
        └── Search
              │
              ▼
           Router
```

A post opened from the terminal and the same post clicked from the sidebar must resolve to exactly the same route.

Navigation metadata should live in a reusable TypeScript module rather than being hardcoded independently inside components.

---

## 6. Virtual Filesystem

The blog should expose its information architecture as a virtual filesystem.

Example:

```text
~
├── posts/
│   ├── graphics/
│   ├── programming/
│   └── thoughts/
├── projects/
├── notes/
└── about.md
```

This is a website abstraction. It is NOT the user's actual operating-system filesystem.

A virtual node may conceptually contain:

```ts
interface VirtualNode {
  name: string
  type: "directory" | "post" | "page"
  path: string
  route?: string
  children?: VirtualNode[]
}
```

The exact implementation may differ, but sidebar navigation, terminal commands, and search should derive from the same underlying content model whenever practical.

---

## 7. Terminal

The terminal is NOT a real shell or full terminal emulator.

It is a command-driven navigation interface over the blog's virtual filesystem.

Do not execute arbitrary shell commands from browser input.

Do not expose server/system shell access.

Do not add xterm.js unless a future requirement genuinely needs terminal-emulation behavior beyond the blog command interface.

### Required initial commands

Implement a small, extensible command system.

Initial command set:

- `help`
- `ls`
- `cd`
- `pwd`
- `cat`
- `open`
- `tree`
- `search`
- `clear`
- `history`
- `theme`
- `home`

Optional future commands / easter eggs:

- `whoami`
- `uname`
- `neofetch`
- `fortune`

Example:

```text
akira@blog:~$ cd posts
akira@blog:~/posts$ ls
akira@blog:~/posts$ cat learning-opengl.md
```

Opening/catting a post should ultimately navigate to the canonical post route.

### Terminal implementation structure

Keep parsing, command execution, virtual filesystem logic, and rendering separate.

Preferred organization:

```text
src/lib/terminal/
├── commands.ts
├── parser.ts
├── executor.ts
└── filesystem.ts
```

Avoid a single component containing a long chain of command-specific `if` statements.

### Keyboard shortcut

Use:

```text
Ctrl + `
```

to toggle the terminal.

Do not use `Ctrl + Tab` as the primary shortcut because browsers reserve it for tab switching and it cannot be relied on as a website shortcut.

`Esc` should close the terminal when appropriate.

The terminal must not permanently trap keyboard focus.

On touch/mobile devices, provide an explicit terminal button because keyboard shortcuts may not exist.

---

## 8. Theme System

Support:

- light
- dark
- system

Theme selection should persist locally.

Use CSS custom properties as design tokens, for example:

```css
--bg;
--fg;
--muted;
--border;
--accent;
--sidebar-bg;
--terminal-bg;
--code-bg;
```

Do not scatter hard-coded theme colors throughout components.

The light theme may take visual inspiration from cream/light terminal themes rather than generic pure white.

The dark theme should preserve comfortable reading contrast and should not become a neon-heavy cyberpunk theme.

---

## 9. Visual Language

The site should be:

- terminal-inspired
- editor-inspired
- typography-first
- restrained
- readable
- lightweight
- functional

Prefer:

- monospace typography where appropriate
- thin separators and borders
- clear text hierarchy
- ASCII decoration
- subtle hover/focus states
- minimal, purposeful transitions
- content density similar to text editors / start screens

Avoid:

- excessive rounded cards
- excessive gradients
- glassmorphism
- huge hero sections
- unnecessary animated backgrounds
- decorative terminal noise
- generic SaaS dashboard aesthetics
- animations that reduce readability

Terminal aesthetics must remain subordinate to reading comfort.

---

## 10. Obsidian Is the Canonical Content Source

Obsidian is the primary writing environment and source of truth for authored notes/posts.

The blog must adapt to the existing Obsidian frontmatter format.

Do NOT require the user to rewrite all existing notes to satisfy a blog-specific schema.

Existing frontmatter format:

```yaml
---
title: ${title}
tags:
type: ${noteType}
categories: ${categoriesYAML}
aliases: []
created: ${tp.file.creation_date("YYYY-MM-DD HH:mm:ss")}
---
```

The publishing pipeline may normalize this data into the internal Astro content schema.

Do not mutate the original Obsidian note during publishing.

---

## 11. Obsidian → Blog Publishing Adapter

Implement publishing as an adapter/synchronization layer.

Conceptually:

```text
Obsidian Vault
      │
      │ read only
      ▼
Publisher / Adapter
      │
      ├── discover publishable notes
      ├── parse frontmatter
      ├── validate
      ├── normalize metadata
      ├── convert Obsidian-specific syntax when needed
      ├── resolve/copy referenced assets
      └── emit blog content
      ▼
src/content/
      │
      ▼
Astro build
```

As explicitly updated by the user on 2026-09-19, the workspace convention uses the Obsidian `status: archived` field to identify notes that should be imported/published. Preserve that behavior unless the user explicitly changes the publishing rule.

The adapter must be configurable enough that the publish-selection rule can later change without rewriting the entire content layer.

### Important rule

Never modify the source note as a side effect of sync.

The blog may generate normalized copies under `src/content/`.

---

## 12. Frontmatter Normalization

The Obsidian metadata schema and the internal blog schema are allowed to differ.

Example internal model:

```ts
interface BlogEntry {
  title: string
  type?: string
  tags: string[]
  categories: string[]
  aliases: string[]
  created: Date
  updated?: Date
  description?: string
  slug: string
  draft?: boolean
}
```

Blog-only fields should be derived when possible.

### Slug

Prefer deriving the stable slug from the Markdown filename unless the note explicitly provides one.

Example:

```text
quaternion-rotation.md
        ↓
/posts/quaternion-rotation/
```

The display `title` may change without forcing the route to change.

Do not derive the canonical URL solely from the current title if that would make links unstable.

---

## 13. Obsidian-Specific Markdown

Expect Obsidian syntax that ordinary Markdown engines may not understand.

Examples:

```md
[[Quaternion]]
![[rotation.png]]
```

The publishing adapter should have a clear strategy for at least:

- wikilinks
- embedded images/files
- local attachment paths
- URL-safe generated links
- missing referenced files
- name collisions

Do not silently destroy unsupported syntax.

If a link or asset cannot be resolved, emit a clear build/sync warning.

Keep transformation code isolated from UI components.

---

## 14. Content Organization

Suggested structure:

```text
src/
├── content/
│   ├── posts/
│   ├── notes/
│   └── projects/
```

Exact collections may evolve with actual content.

Do not prematurely create many content types with no content or use case.

The content schema should be validated at build time.

---

## 15. Suggested Project Structure

```text
akira-blog/
├── .github/
│   └── workflows/
│       └── deploy.yml
│
├── public/
│
├── scripts/
│   └── sync-obsidian.ts
│
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── Dashboard.astro
│   │   │   ├── AsciiLogo.astro
│   │   │   └── RecentPosts.astro
│   │   │
│   │   ├── terminal/
│   │   │   ├── Terminal.*
│   │   │   ├── TerminalPrompt.*
│   │   │   └── TerminalOutput.*
│   │   │
│   │   ├── Sidebar.astro
│   │   └── ThemeToggle.*
│   │
│   ├── content/
│   │   ├── posts/
│   │   ├── notes/
│   │   └── config.*
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PostLayout.astro
│   │
│   ├── lib/
│   │   ├── terminal/
│   │   │   ├── commands.ts
│   │   │   ├── parser.ts
│   │   │   ├── executor.ts
│   │   │   └── filesystem.ts
│   │   ├── navigation.ts
│   │   └── posts.ts
│   │
│   ├── pages/
│   │   ├── index.astro
│   │   ├── posts/
│   │   ├── projects/
│   │   └── about.astro
│   │
│   └── styles/
│       ├── global.css
│       └── theme.css
│
├── AGENTS.md
├── astro.config.mjs
├── package.json
├── pnpm-lock.yaml
└── tsconfig.json
```

This is guidance, not an absolute file-by-file mandate. Prefer coherent module boundaries over blindly matching the sample tree.

---

## 16. GitHub Repository and GitHub Pages Deployment

The project will be hosted in a GitHub repository and deployed using GitHub Pages.

Use GitHub Actions for build and deployment.

Use the official/recommended Astro GitHub Pages deployment action/workflow rather than committing generated `dist/` output manually.

The repository must include:

```text
.github/workflows/deploy.yml
```

Deployment should run automatically when appropriate changes are pushed to the production branch, normally `main`.

Manual workflow dispatch is also desirable.

### GitHub Pages constraints

The site must remain compatible with static GitHub Pages hosting.

Do not introduce runtime server APIs, private server state, database dependencies, or SSR-only behavior into core functionality unless the deployment architecture is explicitly changed later.

### `site` and `base`

Do not blindly hardcode the final GitHub Pages base path.

Determine deployment mode from the repository:

- user/org Pages repository such as `<username>.github.io`
- project Pages repository such as `<username>.github.io/<repo>/`
- custom domain

Configure Astro's `site` and `base` accordingly.

All internal URLs, assets, navigation links, search indexes, and generated routes must remain correct when the site is hosted under a non-root base path.

Avoid hardcoding root-relative paths such as `/assets/...` when doing so would break project Pages deployment.

Use framework/base-aware URL generation.

### Lockfile

Commit `pnpm-lock.yaml`.

CI should install dependencies deterministically using the lockfile.

### Build before deploy

The deploy workflow must fail if the production build fails.

A broken build must never be treated as a successful deployment.

---

## 17. Git and Repository Hygiene

Keep source code and authored content under version control.

Do not commit:

- `node_modules/`
- local build caches
- local environment files containing secrets
- temporary Obsidian sync output outside the intended generated content directory
- arbitrary OS/editor temporary files

Commit the package-manager lockfile.

Do not place secrets directly in source code or public client bundles.

If GitHub Actions needs secrets in the future, use GitHub repository/environment secrets.

---

## 18. Accessibility and Keyboard UX

Primary navigation must be keyboard accessible.

Requirements:

- visible focus states
- semantic links/buttons
- terminal input has an accessible label
- focus is restored sensibly when terminal closes
- terminal must not trap focus permanently
- theme control must work without a mouse
- interactive controls must have meaningful accessible names

Respect:

```css
prefers-reduced-motion
```

Do not make essential information available only through hover.

---

## 19. Responsive Behavior

Desktop may use the full sidebar/content/terminal layout.

Tablet/mobile should preserve access to:

- navigation
- article reading
- theme switching
- terminal
- search

Do not shrink the desktop UI until text becomes unreadable.

For mobile:

- sidebar may collapse into a drawer/panel
- terminal may use a larger bottom sheet/panel
- terminal must have a visible touch trigger
- article typography takes priority over decorative terminal layout

---

## 20. Performance

Prefer static generation.

Do not ship JavaScript for purely static components.

Only hydrate interactive islands that need client-side behavior.

Avoid large dependencies when a small local implementation is sufficient.

Images should be reasonably optimized.

The blog should remain responsive on ordinary mobile hardware.

---

## 21. Error Handling

Content sync and build tooling must fail clearly.

Examples of errors that should produce useful messages:

- malformed frontmatter
- duplicate slug
- unresolved wikilink
- missing embedded image
- unsupported content type
- invalid date
- route collision
- broken content schema

Do not silently skip malformed published content unless explicitly configured to do so.

Warnings and errors should identify the source file whenever possible.

---

## 22. Testing Strategy

Prioritize tests for logic with meaningful failure modes.

Good candidates:

- terminal parser
- terminal command execution
- virtual filesystem navigation
- slug derivation
- Obsidian frontmatter normalization
- wikilink conversion
- asset resolution
- navigation route generation

Do not create excessive low-value snapshot tests for static markup.

---

## 23. Verification

Before marking an implementation task complete, verify as applicable:

### Build

- `pnpm install --frozen-lockfile` works in a clean environment
- `pnpm build` succeeds
- TypeScript has no errors
- Astro content schemas pass
- no obvious browser console errors

### Content

- existing Obsidian-style frontmatter remains accepted
- publishable `status: archived` notes are detected correctly
- original Obsidian notes are not modified
- generated blog content is deterministic
- wikilinks/assets are handled or produce explicit warnings

### Navigation

- sidebar navigation works
- terminal navigation works
- sidebar and terminal resolve the same canonical routes
- browser back/forward behavior remains sensible

### Terminal

- toggle shortcut works
- `Esc` behavior works
- supported commands behave correctly
- terminal history works
- invalid commands return useful feedback
- terminal does not expose arbitrary shell execution

### Theme

- light mode works
- dark mode works
- system mode works
- selected theme persists
- no unreadable color combinations

### Responsive / Accessibility

- desktop layout works
- tablet layout remains usable
- mobile layout remains usable
- touch users can open terminal
- keyboard navigation works
- focus states are visible
- reduced-motion preference is respected

### GitHub Pages

- production build is fully static
- base-path handling is correct
- internal links work under the actual GitHub Pages URL
- assets load under the actual GitHub Pages URL
- GitHub Actions deployment workflow succeeds

---

## 24. Agent Working Rules

Before implementing a non-trivial feature:

1. inspect the existing project structure
2. identify the current source of truth
3. avoid creating duplicate state/models
4. prefer the smallest coherent change
5. preserve existing Obsidian compatibility
6. preserve GitHub Pages static-deployment compatibility
7. explain architectural deviations when they are necessary

For large features, first state:

- affected modules
- data flow
- route/state implications
- expected verification steps

Do not perform broad rewrites merely to make code "cleaner" unless they are necessary for the requested feature.

Do not replace working architecture with a fashionable dependency without a concrete benefit.

---

## 25. Design Principle Summary

When uncertain, use these principles:

> The blog is a filesystem-like information space.

> Sidebar and terminal are two views over the same navigation model.

> Obsidian is the authoring source; the blog owns the publishing adapter.

> Static-first is the default.

> Terminal aesthetics must improve identity without harming readability.

> GitHub Pages is a deployment constraint, not an afterthought.
