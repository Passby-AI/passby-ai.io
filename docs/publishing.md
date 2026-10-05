# Obsidian 本地发布与搜索

Obsidian 是只读来源。同步在本机运行，GitHub Actions 只需要仓库中已生成的内容，不需要访问笔记库。

## 配置与执行

在仓库根目录创建 `obsidian.local.json`（已被 Git 忽略）：

```json
{
  "vault": "D:/path/to/your/vault",
  "publishStatus": "archived"
}
```

也可以使用环境变量 `OBSIDIAN_VAULT`，或执行 `pnpm sync --vault "D:/path/to/your/vault"`。优先级：命令行、环境变量、本地配置。相对路径以运行命令的目录为基准；请从仓库根目录运行。

```sh
pnpm sync --dry-run     # 扫描、校验与转换预检，不写入
pnpm sync              # 同步；不能解析的引用会打印警告
pnpm publish:check     # 严格同步 → 类型检查 → 测试 → 静态构建及索引 → 产物检查
pnpm preview           # 预览构建结果，包括全文搜索
```

`publish:check` 使用 `--strict`：任何引用警告都会使同步失败，后续检查和构建不会启动。没有笔记库配置时命令会明确失败。命令不会提交、推送或部署。

## 日期精度

`created` 优先；缺少或留空时使用 `date`。支持 `date: 2026-2` / `2026-02`，页面显示“2026年2月”，HTML 时间属性和生成内容保留 `2026-02`，不会显示虚构的日或时分。完整日期显示到日；带时间的日期仍按 UTC+8 显示。月份内部按月初排序，同月内具体日期更晚的文章排在前面。

## 发布规则和生成文件

- 默认只选择 `status: archived` 的笔记，`tags` 不参与发布筛选；`draft: true` 不导出。
- `publishStatus` 或 `--publish-status` 可更换目标状态值，无须修改内容层。
- 原有 `title`、`tags`、`type`、`categories`、`aliases`、`created` 原样兼容；校验和日期规则复用网站内容模型。
- 默认 slug 来源于文件名：空格及标点转为连字符，+ 转为 -plus，# 转为 -sharp；已有合法名称保持不变，转换重名会报错。显式 `slug` 优先。标题变化不会改变 URL。
- 所有选中笔记目前导入 **posts** 集合；`type` 是元数据，不用于创建额外集合。
- 隐藏文件／目录及符号链接不扫描。扫描到的损坏 YAML 会报告来源并停止，选中笔记的无效字段也会阻止同步。
- 源笔记库与博客目录不能重叠。源 Markdown 和附件均不写入。

输出路径：

```text
src/content/posts/obsidian/<slug>.md
src/content/posts/obsidian/manifest.json
public/published-assets/<sha256>.<extension>
```

这三类文件应一起提交 Git。清单只记录输出路径和校验值，不保存笔记库的绝对路径。不要在生成目录手工编写文章；本地文章可以继续放在 `src/content/posts/` 的其他位置。

重复同步内容相同时不会重写文件。修改 status、删除笔记、改为草稿或移除附件引用后，下次同步会清理清单中不再使用的生成文件。同步会预先校验所有输出：手工编辑过的生成文件、未受管理的同名文件、与本地文章重复的 slug 都会阻止写入。遇到手工修改冲突，应先移出并保存修改，再在 Obsidian 中更新来源。

同步前先完整解析和校验；文件系统写入错误仍会明确失败。同步不支持多个进程同时运行，请勿与另一次同步或构建并发操作同一份输出。

## 链接和附件

支持 `[[Note]]`、`[[Note|显示文字]]`、`[[Note#标题]]`、`![[image.png]]`，以及普通 Markdown 相对链接、图片和引用式附件。

解析顺序为：当前笔记相对路径 → 笔记库根路径 → 唯一文件名／路径后缀 → 唯一笔记别名。重名且无法唯一定位时报告候选文件，建议使用明确路径。笔记链接只能指向本次选中的非草稿笔记；不会为解决链接而自动发布私有内容。

图片复制到按内容哈希命名的静态路径；不同内容的同名附件不会互相覆盖。支持常见图片、PDF、音视频、ZIP、TXT；非图片嵌入转换为文件链接。生成的 `blog:/…` URL 在 Astro 7 原生 Markdown 插件中通过公共路由 helper 添加部署 base，因此换部署路径无需重新同步。

Markdown 转换基于语法树，保留代码、转义文本、GFM 表格／任务列表和数学语法。笔记嵌入 `![[Note]]`、块引用 `#^id`、缺失文件、未发布笔记、歧义附件、未知文件类型会警告并保留原引用文字。Raw HTML 会保留并提示其中的 URL 不自动转换。标题锚点按 Astro 使用的 GitHub slug 规则生成；不支持块锚点或重复标题的序号选择。图片尺寸别名目前仅作为替代文字，不设置显示尺寸。

## 全文搜索

所有页面底部有搜索入口；终端 `search <query>` 会打开同一个结果页，终端 cwd 和历史按原规则保留。搜索页 URL 保存关键词，刷新和前进／后退可以恢复查询。

Pagefind 在 `pnpm build` 完成后生成静态索引，仅收录标记的已发布文章与独立页面正文。结果地址与共享导航树匹配后才显示，标题和最终链接使用导航树的数据。每次显示 20 条，可继续加载。

搜索模块按需加载，没有搜索后台。`pnpm dev` 没有生产索引，会显示明确提示；使用 `pnpm build` + `pnpm preview` 验证搜索。索引网络失败会提示重试，禁用 JavaScript 时可继续通过侧栏阅读文章。

## 验证与边界

- `pnpm test`：发布选择、幂等、源文件保护、元数据、冲突、引用、撤销发布和搜索路由。
- `pnpm test:publishing`：在临时副本和临时笔记库中运行完整流程，检查根路径与 `/terminal_blog/` 下的链接、中文锚点、图片、表格、草稿过滤、中英文正文搜索及失败短路。
- `pnpm verify:search`：在 Node 中运行实际构建的 Pagefind JS/WASM，验证中文查询及 canonical URL；这不是浏览器 UI 测试。

本次没有读取真实 Obsidian 笔记库。浏览器工具未连接，真实键盘／触摸、桌面／移动端外观、搜索加载失败及前进／后退仍需浏览器验收。

实现依据：[Pagefind 构建 API](https://pagefind.app/docs/node-api/)、[浏览器搜索配置](https://pagefind.app/docs/search-config/)，以及仓库安装版本 Astro 7 的原生 Markdown 插件接口。
