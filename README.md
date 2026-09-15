# Akira's Blog

基于 Astro + TypeScript 的静态个人博客，以 Markdown / Obsidian 为内容源，逐步实现终端与文件系统风格的阅读和导航体验。

产品和架构约束见 [AGENTS.md](AGENTS.md)，任务范围和依赖见 [PLAN.md](PLAN.md)。当前已实现 **T0：项目初始化**、**T1：设计变量与全局样式**。

## 本地开发

使用 Node.js 22.12.0 或更高版本的偶数版本（推荐 Node.js 24 LTS），以及固定版本的 pnpm：

```sh
npm install --global pnpm@10.34.5
pnpm install --frozen-lockfile
pnpm dev
```

打开开发服务输出的地址，默认为 `http://localhost:4321`。

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动本地开发服务 |
| `pnpm check` | 检查 Astro 和 TypeScript |
| `pnpm build` | 将静态站点生成到 `dist/` |
| `pnpm preview` | 本地预览构建后的站点 |
| `pnpm astro --help` | 查看 Astro CLI 命令 |

提交前运行 `pnpm check` 和 `pnpm build`。生产站点只需要托管 `dist/` 中的静态文件，不依赖持续运行的后端；`pnpm dev` 和 `pnpm preview` 用于本地开发与验证。

## 目录结构

```text
public/                    原样复制的静态资源
scripts/                   发布工具预留目录（T15 实现 Obsidian 同步）
src/
  components/
    dashboard/             仪表盘组件预留目录
    terminal/              终端界面组件预留目录
  content/                 Markdown 内容预留目录（T2 定义集合）
  layouts/BaseLayout.astro  HTML 文档基础布局
  lib/terminal/            终端纯逻辑预留目录
  pages/index.astro        静态占位首页
  styles/global.css       全局排版、控件、焦点及减少动态效果的规则
  styles/theme.css        主题颜色、字体、间距与内容宽度变量
astro.config.mjs           静态输出配置
tsconfig.json              Astro strict TypeScript 配置
pnpm-lock.yaml             确定性依赖锁文件
```

占位目录通过 `.gitkeep` 保留，不提前创建无内容的集合或不可用的路由。当前首页只由 Astro 静态渲染，无客户端脚本。

## 主题与样式

`theme.css` 是颜色的唯一来源，组件只引用 `--bg`、`--fg`、`--accent` 等语义变量。浅色使用奶油色背景，深色使用灰黑背景和柔和的绿色强调色。

根元素 `<html>` 上的 `data-theme` 是主题入口：

| 值 | 行为 |
| --- | --- |
| `system`（默认，或移除属性） | 跟随操作系统／浏览器的明暗偏好 |
| `light` | 固定浅色，覆盖系统偏好 |
| `dark` | 固定深色，覆盖系统偏好 |

采用原生 [`light-dark()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark) 与 `color-scheme`，需要支持该功能的现代浏览器（Baseline 2024）。系统偏好变化由 CSS 自动响应，不需要 JavaScript 监听器。T7 将添加切换控件与本地持久化。

开发时可在浏览器开发者工具中修改根元素的 `data-theme`，并模拟系统明暗偏好及 `prefers-reduced-motion: reduce`；固定主题应覆盖系统设置，`system` 应随模拟偏好变化。全局基础样式包含选中文本配色、键盘焦点、控件与代码背景，以及减少动画、过渡和平滑滚动的规则。

## 内容发布与部署

`pnpm sync` 将在 T15 有实际同步实现后加入；届时仅从 Obsidian 源库读取内容，默认选择带 `archived` 标签的笔记，生成的博客内容纳入版本控制。

GitHub Pages 的 `site`、`base` 和部署工作流分别在 T22 / T23 配置，届时根据实际仓库及域名确定。当前尚未配置远程仓库，不预设最终部署 URL。

初始化方式参照 [Astro 官方安装文档](https://docs.astro.build/en/install-and-setup/)，类型检查配置参照 [Astro TypeScript 文档](https://docs.astro.build/en/guides/typescript/)。
