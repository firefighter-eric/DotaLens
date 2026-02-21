# DotaLens

一个基于 **npm + React + Vite** 的 Dota 数据分析 Web App，不需要上架 App Store，可直接在浏览器使用。

## 快速开始

```bash
npm install
npm run dev
```

默认启动后访问控制台输出的本地地址（通常是 `http://localhost:5173`）。

## 可用脚本

- `npm run dev`：开发模式
- `npm run build`：生产构建
- `npm run preview`：本地预览构建结果
- `npm run lint`：代码规范检查

## 当前功能

- 中英文切换（默认中文）
- 输入 OpenDota ID 或 Steam32，拉取真实对局数据
- 14 天 / 30 天分析窗口切换
- 数据概览卡片（总场次、胜率、KDA、最佳英雄）
- 胜率趋势图（按窗口动态计算）
- 英雄表现对比表格
- 段位分布图

## 项目结构

```text
.
├── docs/
│   └── PROJECT_PLAN.md
├── src/
│   ├── components/
│   ├── data/
│   ├── services/
│   ├── utils/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── eslint.config.js
├── index.html
├── package.json
└── vite.config.js
```

## 项目规划

见 `docs/PROJECT_PLAN.md`。
