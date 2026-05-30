# Graph Editor

<p align="center">
  <img src="./public/brand/graph-editor-logo.webp" alt="Graph Editor logo" width="112" height="112" />
</p>

<p align="center">在浏览器中创建、编辑、排布并导出图论图形。</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

Graph Editor 是一个 local-first 的浏览器应用，用来把图论想法快速变成清晰、可编辑的图形。你可以粘贴题面中的边列表，从内置样例开始，调整布局，然后导出为文本数据或 PNG 图片。

公开地址: <https://graph-editor.daikusutora3.workers.dev>

## 亮点

- **快速输入**: 支持粘贴边列表、邻接表、邻接矩阵和应用的 JSON 格式，并会自动识别常见格式。
- **面向图论场景**: 支持有向/无向、带权/无权、0-index/1-index、自环和多重边。
- **69 个内置样例**: 包括路径、环、树、平面图、Petersen 系列、DAG、SCC 示例、流网络等。
- **布局工具**: 支持 force、连通分量、BFS、树、DAG、二分图、SCC、放射、圆形、网格、直线和拉开重叠点布局。
- **导出选项**: 可以复制或保存边列表、邻接表、邻接矩阵、JSON，以及带背景和留白设置的 PNG 图片。
- **多语言界面**: 应用支持日语、英语和简体中文。

## 快速开始

```bash
bun install
bun run dev
```

打开 Next.js 输出的本地地址，通常是 `http://localhost:3000`。

## 常用脚本

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run check
bun run check:all
bun run build
```

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Cytoscape.js
- Jotai
- Tailwind CSS
- Bun

## 项目结构

```text
app/                    Next.js app entry points
features/graph-editor/  Graph editor feature modules
  adapters/             Browser and Cytoscape integration
  canvas/               Interactive graph canvas
  core/                 Graph model, reducers, validation, layouts
  io/                   Import, export, clipboard, and file actions
  samples/              Curated sample graph catalog
  shell/                Editor state and top-level UI shell
  ui/                   Panels, toolbar, starter dialog, screenshot controls
tests/verification/     Graph, IO, layout, adapter, and release checks
public/brand/           App icons and logo assets
```

## 构建

```bash
bun run build
```

应用已配置 Next.js `output: "export"`，可以进行静态导出。
公开发布前请运行 `bun run check:all`。它会覆盖类型检查、lint、格式检查、
图模型/样例/布局/编辑器状态/IO 验证和生产构建。Cloudflare 静态
资源部署使用 `wrangler.jsonc` 和 `public/_headers`。

## 许可证

MIT License。
