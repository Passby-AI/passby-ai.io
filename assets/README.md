# 本地字体

所有下载的字体、转换产物都保存在本目录。原始 TTF 和许可证不被转换脚本修改。

| 用途 | 源文件 | 已核验版本 |
| --- | --- | --- |
| 博客正文 | `LXGW/LXGWWenKai-Regular.ttf` | LXGW WenKai 1.522 |
| 终端区域、代码与等宽 UI | `nerd-fonts/0xProto/0xProtoNerdFontMono-{Regular,Bold,Italic}.ttf` | 0xProto 2.502 / Nerd Fonts 3.5.1 |

上游：

- [霞鹜文楷](https://github.com/lxgw/LxgwWenKai)，许可证在 `LXGW/OFL.txt`。
- [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts)，原始字体为 [0xProto](https://github.com/0xType/0xProto)。
- `nerd-fonts/0xProto/LICENSE` 的内容是 SIL OFL 1.1，不需要另找或改名成 `OFL.txt`。
- Nerd Fonts 附带图标的来源和许可保留在 `nerd-fonts/0xProto/README.md`；关于页提供这些说明与许可证的下载链接。

## 网页产物

`webfonts/fonts.css` 引用同目录的 WOFF2 文件，通过 Vite 打包生成带部署 base 的资源地址。没有外部字体 CDN 请求，也不依赖访客电脑安装字体。

霞鹜文楷按 256 个 Unicode 码位一个范围拆分为 491 个文件，使用 `unicode-range` 按需加载；原字体的 46,490 个字符全部保留。0xProto Mono 的三个字形各保留 11,631 个字符，包括 Nerd Font 图标。中文代码注释使用系统中文字体回退，因为 0xProto 不包含中文。

原始常规／粗体／斜体以及其他 Nerd Font 变体仍保留。网站只引用 Mono 三种字形。下载压缩包 `*.zip` 是本地备份，忽略提交。

## 重新生成（仅维护字体时需要）

需要 Python、FontTools 与 Brotli（或 brotlicffi）：

```sh
python -m pip install "fonttools[woff]"
python scripts/prepare-fonts.py
```

生成后的 `assets/webfonts/` 应纳入版本控制。正常 `pnpm build` 不需要 Python、重新下载或重新转换字体。

## 原文件 SHA-256

```text
LXGWWenKai-Regular.ttf
39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009
0xProtoNerdFontMono-Regular.ttf
9d8f521c75a8aa804a942baa3f6438cbfd311d12d59251af955aa75f51b8e135
0xProtoNerdFontMono-Bold.ttf
77d1c2a6fd7d50686b9896fa476cb759bd9e5644998a959161e18068ae15b642
0xProtoNerdFontMono-Italic.ttf
b99875f3bd1baa47484b101b0efb6f1f13cf7c1027d900d23a414884b897eaac
```
