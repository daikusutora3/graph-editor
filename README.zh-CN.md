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

使用指南: <https://graph-editor.daikusutora3.workers.dev/zh-hans/guide>

## 亮点

- **快速输入**: 支持粘贴边列表、邻接表和邻接矩阵，并会自动识别常见格式。
- **面向图论场景**: 支持有向/无向、带权/无权、0-index/1-index、自环和多重边。
- **79 个内置样例**: 包括基础图族、0–1 BFS、负环、匹配、桥与割点、函数图等。21 种图支持参数调整，可通过随机种子复现树、DAG 和连通图。支持算法名称搜索、类别筛选和直接复制竞赛用边列表。
- **布局工具**: 支持自动布局、BFS、树、DAG、二分图、SCC、放射、圆形、网格、直线、同心圆和拉开重叠点布局。
- **导出选项**: 可以复制或保存边列表、邻接表、邻接矩阵、JSON、TikZ（TeX），以及带背景和留白设置的 PNG 图片。
- **多语言界面**: 应用支持日语、英语和简体中文。

顶点标签和边权各最多允许 256 个 Unicode 码点。超出限制时，文本导入会
显示字段和行号，并拒绝整个输入，不会截断内容。JSON 顶点坐标必须有限且
在 ±1,000,000,000 范围内；越界输入不会修改当前图。

## 快速开始

请按照[开发环境设置](docs/development.md#local-setup)准备 Node **24.15.0**
和 Bun **1.4.2**。启动器也支持此项目目录专用的 `.local-bin/bun`。

```bash
node scripts/toolchain.mjs install --frozen-lockfile
node scripts/toolchain.mjs run dev
```

打开 Next.js 输出的本地地址，通常是 `http://localhost:3000`。

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Cytoscape.js
- Jotai
- Tailwind CSS
- Bun

## 开发文档

请参阅[文档索引](docs/README.md)和[开发指南](docs/development.md)，
了解代码结构、按改动选择的验证命令、浏览器检查和历史设计记录。
准备公开构建前请运行 `node scripts/toolchain.mjs run check:all`。

## 许可证

MIT License。
