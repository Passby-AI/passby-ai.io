# Akira's Blog — Implementation Plan

> This plan is subordinate to `AGENTS.md`. If this document conflicts with `AGENTS.md`, follow `AGENTS.md` unless the user explicitly changes the requirement.

## 0. Goal

Build an MVP of **Akira's Blog** as a static Astro site with:

- Neovim-style dashboard homepage
- filesystem-style sidebar navigation
- Markdown/Obsidian content pipeline
- shared virtual filesystem / route model
- terminal-style command navigation
- light / dark / system themes
- responsive and keyboard-accessible UI
- static deployment to GitHub Pages through GitHub Actions

The MVP is complete when a user can:

1. open the homepage and see the ASCII dashboard and recent posts;
2. browse content from the sidebar;
3. press `Ctrl + \`` to open the terminal;
4. use terminal commands to navigate to the same pages as the sidebar;
5. switch theme;
6. publish an existing Obsidian note without changing its original frontmatter format;
7. push the repository to GitHub and obtain a working GitHub Pages deployment.

---

## 1. Delivery Strategy

Do not ask an agent to implement the whole project in one pass.

Work in vertical slices. Every task should leave the repository buildable.

Recommended milestone order:

```text
M0 Repository bootstrap
        ↓
M1 Content + routing foundation
        ↓
M2 Application shell + visual system
        ↓
M3 Dashboard + reading experience
        ↓
M4 Virtual filesystem + terminal
        ↓
M5 Obsidian publishing adapter
        ↓
M6 Search + responsive/accessibility polish
        ↓
M7 GitHub Pages release
```

The site should be deployable before optional polish or easter eggs are added.

---

# Milestone M0 — Repository Bootstrap

## T0 — Initialize Astro project

**Priority:** P0  
**Dependencies:** none

**Status:** Completed on 2026-09-11.

Verification: `pnpm install --frozen-lockfile` succeeded in a clean directory
containing only the package manifest and lockfile (using the local pnpm cache);
`pnpm check` reported 0 errors, warnings, or hints; `pnpm build` generated static
HTML without client-side scripts; `pnpm dev --host 127.0.0.1` served the homepage
with HTTP 200. Browser visual/console verification was unavailable in this session.
The Obsidian `sync` script is deferred to T15, where its implementation belongs.

### Scope

- initialize Astro + TypeScript
- use `pnpm`
- create basic source structure from `AGENTS.md`
- add `.gitignore`
- commit `pnpm-lock.yaml`
- create placeholder homepage
- add useful package scripts

Suggested scripts:

```json
{
  "dev": "astro dev",
  "build": "astro build",
  "preview": "astro preview",
  "check": "astro check",
  "sync": "tsx scripts/sync-obsidian.ts"
}
```

Do not install React/Svelte yet unless a concrete interactive implementation needs it.

### Acceptance criteria

- `pnpm install --frozen-lockfile` succeeds after lockfile exists
- `pnpm dev` starts the site
- `pnpm build` succeeds
- `pnpm check` succeeds
- no runtime backend is required

---

## T1 — Establish design tokens and global styles

**Priority:** P0  
**Dependencies:** T0

**Status:** Completed on 2026-09-15.

Implemented centralized semantic color, typography, and spacing tokens;
CSS-only light/dark/system modes via root `data-theme` and `color-scheme`;
global focus, selection, controls, code, and reduced-motion styles.
Theme controls and persistence remain in T7.

Verification: `pnpm check` reported 0 errors, warnings, or hints; `pnpm build`
succeeded. Generated CSS contains all required theme/accessibility rules and
the static homepage has no client-side scripts. Calculated minimum text
contrast across page/sidebar/terminal/code backgrounds is 4.80:1 in light mode
and 5.73:1 in dark mode; selection text is 10.12:1 and 7.32:1 respectively.
The development homepage returned HTTP 200 with `data-theme="system"`.
Browser visual/console and live OS-preference verification were unavailable
in this session. Theme CSS requires `light-dark()` support (Baseline 2024).

### Scope

Create the global visual foundation before feature-specific styling.

Define CSS variables for at least:

```css
--bg;
--fg;
--muted;
--border;
--accent;
--sidebar-bg;
--terminal-bg;
--code-bg;
--selection-bg;
```

Create three theme modes:

- light
- dark
- system

Use a restrained terminal/editor aesthetic. Avoid UI-library defaults, glassmorphism, gradients, and excessive rounded cards.

### Acceptance criteria

- light theme is readable
- dark theme is readable
- system mode follows OS preference
- colors are not duplicated as arbitrary hard-coded values across components
- `prefers-reduced-motion` has a baseline rule

---

# Milestone M1 — Content and Routing Foundation

## T2 — Define blog content schema

**Priority:** P0  
**Dependencies:** T0

### Scope

Create Astro content collections for the content types actually needed by the MVP.

Start with:

- posts
- pages (or equivalent handling for `about.md`)

Do not create speculative collections without content.

The internal normalized post model should support:

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

Add 2–3 sample Markdown posts using the user's existing Obsidian-style frontmatter.

### Acceptance criteria

- sample Markdown is rendered through Astro
- existing Obsidian fields are accepted
- invalid required data produces a useful build error
- slug can be derived from filename
- changing `title` does not need to change the canonical route

---

## T3 — Build canonical route helpers

**Priority:** P0  
**Dependencies:** T2

### Scope

Create one route-generation layer used everywhere.

Do not hardcode route strings independently in:

- sidebar
- dashboard
- terminal
- search

Create helpers for:

- post route
- page route
- base-path-aware URLs

The implementation must remain valid when GitHub Pages hosts the project under a repository subpath.

### Acceptance criteria

- a post has one canonical route
- route generation has one source of truth
- no duplicated `"/posts/..."` construction in unrelated UI components
- helpers can accommodate a non-root GitHub Pages `base`

---

## T4 — Implement post index and post page

**Priority:** P0  
**Dependencies:** T2, T3

### Scope

Implement:

- posts index
- individual post routes
- title
- created date
- tags/categories where available
- Markdown body
- syntax highlighting
- readable article typography

Do not over-design article pages. Reading quality takes priority over terminal decoration.

### Acceptance criteria

- all sample posts are accessible
- invalid/draft posts are handled consistently
- code blocks render correctly
- internal post links use canonical route helpers

---

# Milestone M2 — Application Shell and Navigation

## T5 — Create desktop application shell

**Priority:** P0  
**Dependencies:** T1, T3

### Scope

Implement the shared layout:

```text
sidebar | content
-----------------
terminal (when open)
```

The terminal area may be a placeholder in this task.

Create:

- `BaseLayout`
- content region
- sidebar region
- terminal region slot/container

### Acceptance criteria

- layout works at normal desktop widths
- content area can resize when terminal area is shown
- page navigation does not recreate inconsistent shell state unnecessarily
- no terminal command logic is implemented here

---

## T6 — Build filesystem-style sidebar

**Priority:** P0  
**Dependencies:** T3, T5

### Scope

Implement a navigation sidebar that visually resembles a small file tree.

Initial entries:

```text
~/
├── posts/
├── projects/   (may be placeholder if no projects exist yet)
├── notes/      (may be placeholder if no notes exist yet)
└── about.md
```

Only expose real routes as clickable destinations.

### Acceptance criteria

- sidebar uses canonical navigation data
- current route is identifiable
- navigation works with keyboard
- no second hardcoded route map is created

---

## T7 — Implement theme controller

**Priority:** P1  
**Dependencies:** T1, T5

### Scope

Add a theme control supporting:

- light
- dark
- system

Persist explicit preference in local storage.

Avoid a flash of the wrong theme where practical.

### Acceptance criteria

- all three modes work
- explicit selection survives refresh
- theme UI is keyboard accessible
- theme colors also apply to terminal/dashboard/code blocks

---

# Milestone M3 — Dashboard and Reading Experience

## T8 — Build ASCII logo component

**Priority:** P1  
**Dependencies:** T1

### Scope

Create a stored ASCII/text logo for:

```text
AKIRA'S BLOG
```

The logo may be generated externally once, but should be committed as text/source rather than generated at runtime.

### Acceptance criteria

- logo renders correctly in supported desktop widths
- text remains selectable
- no heavy runtime dependency exists only for the logo
- responsive fallback prevents destructive overflow

---

## T9 — Build Neovim-style homepage dashboard

**Priority:** P0  
**Dependencies:** T4, T5, T8

### Scope

Homepage must contain:

- ASCII logo
- blog name
- recent posts
- dates
- clickable post titles
- navigation hints
- terminal shortcut hint

Recent posts should come from the content collection and be ordered by date.

### Acceptance criteria

- dashboard is the first meaningful homepage content
- recent posts are data-driven
- clicking a recent post opens its canonical route
- no conventional oversized marketing hero section appears
- layout works in both light and dark themes

---

# Milestone M4 — Shared Virtual Filesystem and Terminal

## T10 — Implement virtual filesystem model

**Priority:** P0  
**Dependencies:** T2, T3

### Scope

Create the website-level virtual filesystem model.

It should be derivable from the same content/navigation data used by the GUI.

Support node types such as:

```ts
type VirtualNodeType = "directory" | "post" | "page"
```

Provide operations needed later by the terminal:

- resolve path
- list directory
- move to parent
- obtain canonical route from a file/page node
- render tree

### Acceptance criteria

- virtual filesystem has unit-testable pure logic
- filesystem paths are not OS filesystem paths
- sidebar/content and virtual filesystem do not disagree about canonical destinations
- path resolution supports `.` and `..` where sensible

---

## T11 — Implement terminal parser and command registry

**Priority:** P0  
**Dependencies:** T10

### Scope

Implement terminal logic independently of terminal UI.

Create modules conceptually equivalent to:

```text
parser.ts
commands.ts
executor.ts
filesystem.ts
```

Support parsing:

- command name
- arguments
- whitespace
- empty input

Do not implement arbitrary shell execution.

### Acceptance criteria

- parser can be tested without a browser
- unknown commands produce structured errors/results
- command registration is extensible
- command logic is not a giant component-level `if/else` chain

---

## T12 — Implement core terminal commands

**Priority:** P0  
**Dependencies:** T11

### Scope

Implement the MVP command set:

- `help`
- `ls`
- `cd`
- `pwd`
- `cat`
- `open`
- `tree`
- `clear`
- `history`
- `theme`
- `home`

`search` may depend on T17 and can temporarily return a clear "not available yet" response until search is implemented.

Define command semantics before implementing decorative behavior.

Suggested interpretation:

- `cat <post>`: open the canonical post route, or display a concise preview if the architecture later explicitly chooses that behavior
- `open <node>`: navigate to canonical route
- `home`: navigate to dashboard
- `theme <light|dark|system>`: use the same theme controller as GUI

### Acceptance criteria

- commands operate on the virtual filesystem
- navigation commands resolve the same canonical routes as sidebar links
- invalid paths return useful terminal output
- command history is deterministic
- no command reaches the real host shell

---

## T13 — Build terminal UI

**Priority:** P0  
**Dependencies:** T5, T11, T12

### Scope

Create the actual terminal panel.

Required behavior:

- `Ctrl + \`` toggles terminal on desktop
- `Esc` closes terminal when appropriate
- touch/mobile trigger exists
- current virtual working directory appears in prompt
- output history is scrollable
- command history can be recalled with keyboard if practical
- opening terminal moves focus to input
- closing terminal restores focus sensibly

Do not use xterm.js for the MVP.

### Acceptance criteria

- terminal can be fully used with keyboard
- terminal does not permanently trap focus
- page remains readable when terminal opens
- terminal and sidebar navigation produce the same destinations
- terminal remains usable on touch devices via explicit control

---

## T14 — Integrate terminal state with GUI state

**Priority:** P1  
**Dependencies:** T6, T7, T13

### Scope

Remove accidental duplicated behavior between GUI and terminal.

Unify at least:

- routes
- theme changes
- home navigation
- content selection

### Acceptance criteria

- `theme dark` produces the same state as selecting dark mode in the GUI
- navigating to a post by terminal matches sidebar/dashboard behavior
- browser back/forward remains sensible

---

# Milestone M5 — Obsidian Publishing Adapter

## T15 — Implement minimal Obsidian sync pipeline

**Priority:** P0  
**Dependencies:** T2

### Scope

Create:

```text
scripts/sync-obsidian.ts
```

The source Obsidian vault is external/read-only from the blog's perspective.

For the MVP, the script should:

1. accept/configure a vault path locally;
2. scan Markdown notes;
3. parse existing frontmatter;
4. identify publishable notes using the existing `archived` convention;
5. normalize metadata;
6. derive slug from filename unless explicitly provided;
7. write normalized copies into `src/content/...`;
8. never modify the original note.

### Important GitHub constraint

GitHub Actions cannot read a private/local Obsidian vault on the user's computer.

Default MVP workflow:

```text
Local Obsidian Vault
      ↓
pnpm sync
      ↓
src/content/ generated/updated locally
      ↓
git commit + push
      ↓
GitHub Actions builds static site
```

Therefore, unless the architecture is explicitly changed later, the publishable generated Markdown under `src/content/` should be committed to the repository so GitHub Pages can build without access to the private vault.

Do not commit the entire private Obsidian vault merely to make CI work.

### Acceptance criteria

- sync does not modify the source vault
- only notes matching the publish rule are emitted
- repeat sync is deterministic/idempotent
- duplicate output slugs are reported clearly
- invalid frontmatter identifies its source file
- generated content builds successfully

---

## T16 — Support Obsidian wikilinks and attachments

**Priority:** P1  
**Dependencies:** T15

### Scope

Handle at least:

```md
[[Some Note]]
![[image.png]]
```

Implement a deterministic resolution strategy for:

- wikilinks to published notes
- embedded images
- asset copying
- duplicate attachment names
- missing assets
- unresolved links

Keep this transform inside the publishing adapter, not UI components.

### Acceptance criteria

- resolved wikilinks work after deployment
- images are copied to a GitHub-Pages-safe static path
- unresolved references produce warnings/errors with source filenames
- source Obsidian Markdown remains untouched

---

## T17 — Add one-command local publishing workflow

**Priority:** P1  
**Dependencies:** T15, T16

### Scope

Provide a predictable local workflow, for example:

```bash
pnpm sync
pnpm build
```

Optionally add:

```bash
pnpm publish:check
```

that performs sync + validation + build without pushing to GitHub.

Do not automate `git push` by default without explicit user intent.

### Acceptance criteria

- user can validate a publish locally with one command
- failed sync prevents a misleading successful build workflow
- private vault path is not hardcoded into committed source

---

# Milestone M6 — Search, Responsive UX, and Quality

## T18 — Implement content search

**Priority:** P1  
**Dependencies:** T4

### Scope

Prefer Pagefind for static site search unless a smaller Fuse.js solution is clearly better for the actual content size.

Search should expose results through:

- normal GUI search entry point
- terminal `search <query>` command

Both must resolve canonical routes through the same route helpers.

### Acceptance criteria

- search finds published content
- result routes are correct under GitHub Pages base paths
- terminal search and GUI search agree on destinations
- no backend search service is required

---

## T19 — Responsive layout pass

**Priority:** P1  
**Dependencies:** T6, T9, T13

### Scope

Verify and refine:

- desktop
- tablet
- mobile

Recommended mobile behavior:

- collapsible/drawer sidebar
- explicit terminal trigger
- terminal as bottom panel/sheet if needed
- article reading width prioritized
- dashboard ASCII logo has a fallback when too wide

### Acceptance criteria

- no essential feature requires a physical keyboard
- articles remain readable on narrow screens
- terminal and navigation remain reachable
- layout does not rely on horizontal scrolling for ordinary use

---

## T20 — Accessibility and keyboard pass

**Priority:** P1  
**Dependencies:** T7, T13, T19

### Scope

Verify:

- semantic controls
- visible focus
- logical tab order
- terminal input label
- focus restoration
- reduced motion
- adequate contrast
- screen-reader-friendly button names

### Acceptance criteria

- primary navigation works without mouse
- terminal can be opened, used, and closed with keyboard
- focus is not lost after terminal close
- no essential information is hover-only

---

## T21 — Unit tests for core logic

**Priority:** P1  
**Dependencies:** T10, T12, T15

### Scope

Prioritize tests for logic, not static markup snapshots.

Test at least:

- terminal parser
- command execution
- virtual filesystem path resolution
- slug generation
- frontmatter normalization
- duplicate slug detection
- wikilink conversion
- asset path resolution
- canonical route generation

### Acceptance criteria

- core logic tests run in CI/local checks
- expected failures are tested
- tests do not require a browser unless behavior truly requires it

---

# Milestone M7 — GitHub Pages Release

## T22 — Configure Astro for GitHub Pages

**Priority:** P0  
**Dependencies:** T3, T4

### Scope

Configure deployment without assuming the final hosting shape too early.

Support:

1. `<username>.github.io`
2. `<username>.github.io/<repo>/`
3. future custom domain

Ensure `site` / `base` handling is centralized.

Avoid root-relative asset and route bugs.

### Acceptance criteria

- local production build uses deployment-safe paths
- internal links remain correct under project Pages base path
- static assets remain correct under project Pages base path

---

## T23 — Add GitHub Actions deployment workflow

**Priority:** P0  
**Dependencies:** T0, T22

### Scope

Add:

```text
.github/workflows/deploy.yml
```

Workflow requirements:

- trigger on production branch, normally `main`
- allow manual `workflow_dispatch`
- install pnpm/Node deterministically
- use committed lockfile
- run checks/build before deploy
- deploy generated static artifact to GitHub Pages
- use the official/recommended GitHub Pages/Astro deployment pattern

The CI workflow must not require access to the user's local/private Obsidian vault.

### Acceptance criteria

- pushing `main` triggers deployment
- failed build prevents deployment
- Pages artifact contains the built site
- deployed homepage loads
- post routes load
- CSS/JS/images load
- base-path behavior is correct

---

## T24 — Production smoke test

**Priority:** P0  
**Dependencies:** T23

### Scope

Test the actual deployed GitHub Pages URL, not only localhost.

Verify:

- dashboard
- post navigation
- sidebar
- terminal open/close
- terminal navigation
- light/dark/system theme
- refresh on nested routes
- image paths
- search, if implemented
- mobile viewport

### Acceptance criteria

- no 404 caused by incorrect base paths
- no missing assets
- canonical navigation is stable
- site functions without a backend server

---

# 2. MVP Boundary

The following are **required for MVP**:

```text
T0  Astro bootstrap
T1  design tokens
T2  content schema
T3  canonical routes
T4  post pages
T5  application shell
T6  sidebar
T7  theme
T8  ASCII logo
T9  dashboard
T10 virtual filesystem
T11 terminal parser
T12 terminal commands
T13 terminal UI
T15 minimal Obsidian sync
T22 GitHub Pages config
T23 deploy workflow
T24 production smoke test
```

The following may follow immediately after MVP:

```text
T14 GUI/terminal deeper state integration
T16 advanced Obsidian wikilink/assets
T17 publish-check convenience command
T18 search
T19 responsive polish
T20 accessibility polish
T21 expanded tests
```

Note: basic responsive and accessibility behavior must still exist in MVP; these later tasks are dedicated polish passes.

---

# 3. Explicitly Deferred Features

Do NOT spend MVP time on these unless the user requests them:

- comments system
- account/login system
- server backend
- database
- analytics platform
- RSS enhancements beyond basic feed support
- full terminal emulator
- arbitrary shell execution
- terminal tabs/panes
- complex window manager behavior
- elaborate animations
- canvas/WebGL background effects
- AI chat inside the blog
- CMS admin interface
- automatic Git pushing from the publish script
- `whoami`, `neofetch`, `fortune` and other easter eggs

These may be added after the core interaction model is stable.

---

# 4. Dependency Map

```text
T0
├── T1
│   ├── T5 ── T6
│   │       └── T13
│   └── T8 ── T9
│
├── T2
│   ├── T3 ── T4 ── T9
│   │   └── T22 ── T23 ── T24
│   ├── T10 ── T11 ── T12 ── T13
│   └── T15 ── T16 ── T17
│
└── repository/tooling foundation

T7  depends on T1 + T5
T14 depends on T6 + T7 + T13
T18 depends on T4; terminal integration also needs T12
T19 depends on T6 + T9 + T13
T20 depends on T7 + T13 + T19
T21 depends on T10 + T12 + T15
```

---

# 5. Recommended Agent Execution Batches

To reduce merge conflicts and make worktree-based development practical, use small batches.

## Batch A — Foundation

```text
T0 → T1
T0 → T2 → T3
```

T1 and T2 may run in parallel after T0 if they touch separate files.

## Batch B — First usable blog

```text
T4
T5 → T6 → T7
T8 → T9
```

After this batch, the site should already function as a normal static blog with its intended visual identity.

## Batch C — Terminal architecture

```text
T10 → T11 → T12
T13
T14
```

Do not start with terminal UI. Build the virtual filesystem and command logic first.

## Batch D — Obsidian publisher

```text
T15 → T16 → T17
```

Keep this work isolated from front-end styling.

## Batch E — Deployment

```text
T22 → T23 → T24
```

Do this before optional visual polish becomes large.

## Batch F — Polish

```text
T18
T19
T20
T21
```

---

# 6. Per-Task Agent Prompt Template

When assigning a task to a coding agent, use this structure:

```text
Read AGENTS.md and PLAN.md first.

Implement task <TASK-ID>: <TASK-NAME>.

Scope:
- ...

Dependencies already completed:
- ...

Do not implement:
- unrelated future tasks
- broad refactors not required by this task

Before coding:
1. inspect the existing repository
2. identify affected modules
3. state the implementation plan briefly

After coding:
1. run the relevant checks/tests
2. run `pnpm build`
3. summarize changed files
4. report any deviations from AGENTS.md / PLAN.md
5. do not mark the task complete if acceptance criteria are not met
```

Example:

```text
Read AGENTS.md and PLAN.md first.

Implement T10: virtual filesystem model.

Do not build terminal UI yet.
The goal is a framework-independent, testable virtual filesystem derived from the canonical content/navigation model.

Required operations:
- resolve path
- list directory
- parent traversal
- tree output
- canonical route lookup

After implementation, run tests, `pnpm check`, and `pnpm build`.
```

---

# 7. Definition of Done for the Project

The project reaches the first stable release when all of the following are true:

- the homepage visually communicates the intended Neovim/terminal identity
- recent posts are generated from real content data
- post reading experience is comfortable
- sidebar and terminal share the same navigation model
- terminal supports the required MVP commands
- terminal does not execute arbitrary shell commands
- themes work and persist
- Obsidian source notes do not need their existing frontmatter rewritten
- sync never modifies the original vault
- publishable notes can be synchronized into the blog
- the repository builds deterministically with pnpm
- GitHub Actions deploys successfully to GitHub Pages
- deployed routes and assets work under the real GitHub Pages base path
- site remains usable on mobile and by keyboard

At that point, further work should focus on content and optional enhancements rather than architectural rewrites.
