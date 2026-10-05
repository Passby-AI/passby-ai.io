# Akira's Blog

基于 Astro + TypeScript 的静态个人博客。Markdown / Obsidian 是内容来源，界面采用终端与文件系统风格。

约束见 [AGENTS.md](AGENTS.md)，进度见 [PLAN.md](PLAN.md)。目前已实现 T0–T18，以及新增的本地字体任务 T8a。T15–T18 的本地发布与搜索说明见 [docs/publishing.md](docs/publishing.md)。浏览器视觉／交互验收仍待完成；当前环境的浏览器工具未连接到可用浏览器，验收清单见 [docs/terminal-acceptance.md](docs/terminal-acceptance.md)。

## 开发与验证

使用 Node.js 22.12.0 或更高的偶数版本和 pnpm 10.34.5：

```sh
pnpm install --frozen-lockfile
pnpm dev
```

开发地址通常为 `http://localhost:4321`。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 本地开发 |
| `pnpm check` | Astro / TypeScript 类型检查 |
| `pnpm test` | 内容、路由、主题、终端逻辑及控制器事件测试 |
| `pnpm test:content-build` | 用临时内容验证构建错误与草稿过滤；请勿同时运行其他构建或开发服务器 |
| `pnpm build` | 构建纯静态页面到 `dist/` |
| `pnpm verify:build` | 检查构建产物中的导航、字体、资源和时间显示 |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm sync` | 从本地配置的只读 Obsidian 笔记库导入 `status: archived` 非草稿笔记 |
| `pnpm publish:check` | 严格同步、类型检查、测试、构建及产物检查；不提交或推送 |
| `pnpm test:publishing` | 使用隔离副本验证完整发布和根／子路径搜索 |
| `pnpm verify:search` | 验证实际构建的 Pagefind JS/WASM 搜索 |

验证 GitHub Pages 项目子路径，无需提前确定部署地址：

```sh
pnpm build --base /terminal_blog/ --outDir .astro/base-verification
node scripts/verify-build.mjs .astro/base-verification /terminal_blog/
```

生产 `site` / `base` 和 GitHub Actions 将在 T22 / T23 按实际仓库配置。此次并未部署或推送 Git。

## 内容与路由

```text
src/content/posts/*.md      文章（由本地内容与 Obsidian 同步内容组成）
src/content/pages/*.md      独立页面（当前为 about.md）
src/content.config.ts       Astro 内容集合
src/lib/content-loader.ts   保留原始 YAML 时间写法的 glob 适配器
src/lib/content-model.ts    元数据、日期、slug 校验与发布过滤
src/lib/routes.ts           唯一的 URL 生成入口
src/lib/navigation.ts       从 Astro 集合读取已发布内容，构建共享导航树
src/lib/navigation-model.ts 无 Astro 依赖的共享导航树构建函数
src/lib/terminal/           虚拟路径、解析器、命令、执行器、会话与历史
src/scripts/terminal.ts     原生浏览器终端控制器
```

继续使用已有 Obsidian frontmatter：

```yaml
---
title: 一篇笔记
tags:
  - archived
type: learning
categories: 编程
aliases: []
created: 2026-09-16 20:30:00
---
```

- `title` 必填；日期优先取 `created`，缺少时读取 `date`。`date: 2026-2` 显示为“2026年2月”，保留月份精度。标签、分类和别名支持留空、单字符串或字符串列表。
- 支持可选的 `updated`、`description`、`slug`、`draft`。`draft: true` 不生成页面，也不出现在索引和侧栏。
- 不带时区的时间按 **Asia/Shanghai（UTC+8）** 解释；带时区的 ISO 时间保留实际时刻。带引号和不带引号的写法一致，显示统一为北京时间。
- 默认 slug 来自 Markdown 文件名，与标题无关；可用 `slug` 显式覆盖。路径段允许中英文、数字、连字符、下划线；空格在派生时转为连字符。
- 同名文件产生相同 slug 时构建失败，并列出来源。非法日期、必填字段缺失、保留页面路径冲突也会阻止构建。
- 文章路由为 `posts/<slug>/`，独立页面为 `<slug>/`；UI 通过公共 helper 获得包含部署 base 的 URL。

`pnpm sync` 默认导入`status: archived` 的非草稿笔记，支持 wikilink、附件复制、冲突检查和撤销发布清理。请按 [本地发布说明](docs/publishing.md) 配置被 Git 忽略的 `obsidian.local.json` 或 `OBSIDIAN_VAULT`。生成的 Markdown、清单和附件应一起提交；源笔记始终只读。本次仅使用临时笔记库验证，没有读取真实外部笔记库。

## 布局与主题

桌面为文件树侧栏、阅读区、底部状态栏；窄屏为紧凑导航和正常文档滚动。项目与笔记尚无内容，因此显示为不可点击的占位目录。

`BaseLayout` 中的终端占用底部网格空间，打开时压缩桌面阅读区域。移动端为底部面板，正文增加底部留白，始终有可触摸的终端按钮。

主题选择支持浅色、深色、跟随系统，通过同步 head 脚本在首次绘制前恢复 `localStorage` 偏好。系统主题变化由 CSS `color-scheme` / `light-dark()` 响应。代码高亮也提供两种配色。

主题 API：`window.blogTheme.get()` 和 `window.blogTheme.set('light' | 'dark' | 'system')`，GUI 与终端共用。存储受限时仍可在当前页面切换。禁用 JavaScript 时保留系统主题、仪表盘和原生导航。

首页展示 ASCII Logo、最多五篇最近文章及北京时间、共享导航入口与终端使用提示。

## 终端使用

按 **Ctrl + 反引号（`）** 或点击底部「终端」按钮打开。焦点在终端内时，按 **Esc** 关闭并恢复原焦点；Tab 可以正常离开终端。首页的 `help` 入口打开终端并填入命令，按回车执行。

逐行输入，例如：

```text
help
cd posts
ls
cat about.md
theme dark
home
```

| 命令 | 行为 |
| --- | --- |
| `help` | 显示全部命令 |
| `ls [path]` | 列目录；默认当前目录 |
| `cd [path]` | 只改变虚拟目录；无参数回到 `~` |
| `pwd` | 显示当前虚拟目录 |
| `cat <file>` | 打开文章或独立页面 |
| `open [path]` | 打开对应网页；无参数打开当前目录的网页 |
| `tree [path]` | 显示目录树 |
| `history` | 显示最近 100 条命令，包含这次 `history` |
| `clear` | 清空输出，保留命令历史 |
| `theme [light\|dark\|system]` | 查看或改变与 GUI 共用的主题 |
| `home` | 打开首页，并将目录设为 `~` |
| `search <query>` | 打开与 GUI 共用的全文搜索结果页，支持中英文正文 |

路径区分大小写，支持 `~`、`/`、`.`、`..` 和带引号的参数。`projects/`、`notes/` 可以作为空目录浏览，但没有可打开的网页。这里只处理博客的虚拟文件系统，不能执行主机命令、管道或重定向。

上下键回看历史，下键越过最新历史时恢复未提交的输入。目录、历史、输出、输入草稿和开关状态保存在当前标签页的 `sessionStorage`，不同部署 base 隔离；最近保留 200 行输出。GUI 跳转保留 cwd，`home` 明确重置 cwd。页面跳转采用原生浏览器导航，没有额外客户端路由器。

浏览器禁止会话存储时，命令仍可在当前页工作，但跨页无法保留终端状态。

## 字体

- 正文：**霞鹜文楷 1.522**。
- 终端区域、Markdown 代码与等宽 UI：**0xProto Nerd Font Mono**，使用常规、粗体、斜体三个字体文件。
- 所有原始字体、许可证、WOFF2 和生成的 CSS 都在 `assets/`。
- 霞鹜文楷按 Unicode 范围拆分，浏览器按需请求；生产构建不需要下载字体、Python 或字体 CDN。
- 0xProto 的 `LICENSE` 就是 OFL 许可证；附带图标的来源和许可也保留。关于页提供说明链接。

来源、校验值和重新生成方法见 [assets/README.md](assets/README.md)。

## 当前验证边界

自动测试覆盖终端命令、路径、主题双向同步、焦点调用、输入法保护、会话恢复、Obsidian 发布和搜索路由。隔离发布验证还检查实际 Pagefind JS/WASM 的中英文查询、根／子路径链接、附件和草稿过滤。搜索索引由构建生成，请用 `pnpm build` + `pnpm preview` 预览。

尚未验证真实浏览器中的桌面／移动显示、物理键盘操作、字体绘制、控制台以及动态系统主题切换。请按照 [终端验收清单](docs/terminal-acceptance.md) 检查；模拟 DOM 边界的控制器测试不代替真实浏览器验收。
