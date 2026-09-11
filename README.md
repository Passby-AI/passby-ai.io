# Akira's Blog

基于 Astro + TypeScript 的静态个人博客，以 Markdown / Obsidian 为内容源，逐步实现终端与文件系统风格的阅读和导航体验。

产品和架构约束见 [AGENTS.md](AGENTS.md)，任务范围和依赖见 [PLAN.md](PLAN.md)。当前实现为 **T0：项目初始化**。

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
  styles/global.css       占位页基础样式（T1 扩展主题系统）
astro.config.mjs           静态输出配置
tsconfig.json              Astro strict TypeScript 配置
pnpm-lock.yaml             确定性依赖锁文件
```

占位目录通过 `.gitkeep` 保留，不提前创建无内容的集合或不可用的路由。当前首页只由 Astro 静态渲染，无客户端脚本。

`pnpm sync` 将在 T15 有实际同步实现后加入；届时仅从 Obsidian 源库读取内容，默认选择带 `archived` 标签的笔记，生成的博客内容纳入版本控制。

GitHub Pages 的 `site`、`base` 和部署工作流分别在 T22 / T23 配置，届时根据实际仓库及域名确定。当前尚未配置远程仓库，不预设最终部署 URL。

初始化方式参照 [Astro 官方安装文档](https://docs.astro.build/en/install-and-setup/)，类型检查配置参照 [Astro TypeScript 文档](https://docs.astro.build/en/guides/typescript/)。
