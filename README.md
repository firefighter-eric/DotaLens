# DotaLens

DotaLens 是一个基于 **React 18 + Vite 5** 的 Dota 数据分析前端项目，支持 OpenDota 真实数据查询，并在无可用数据时保留可浏览的示例数据体验。

## 当前能力（2026-03）

- 账号体系：支持 `Steam32` / `OpenDota ID` 两种输入方式
- 多账号管理：本地保存最多 5 个账号，支持快速切换与移除（`localStorage`）
- 时间窗口：`7 / 14 / 30` 天联动分析
- 多 Tab 工作台：
  - `最近对局`：最近 10/20/30 场切换、汇总指标、可点选对局
  - `英雄池`：排序/属性筛选/最少场次过滤/CSV 导出，支持展开英雄对局明细
  - `趋势`：胜率曲线 + 峰值/低点/最新值解读
  - `段位`：窗口内段位分布
  - `总览`：关键结论 + 指标卡
  - `全英雄`：本地英雄目录与详细属性面板
  - `全物品`：本地物品目录与分类浏览
- 对局详情抽屉：展示基础概览、个人核心数据、出装与技能、全场玩家面板
- 国际化：`zh / en` 双语文案
- 错误处理：区分 404、429 与其他 HTTP 错误

## 快速开始

```bash
npm install
npm run dev
```

默认本地地址通常为 `http://localhost:5173`。

## 可用脚本

- `npm run dev`：开发模式
- `npm run lint`：ESLint 检查
- `npm run build`：生产构建
- `npm run preview`：本地预览构建结果
- `npm run sync:heroes`：同步英雄目录与头像
- `npm run sync:items`：同步物品目录与图标

## 数据与资源

- 在线数据：OpenDota API（玩家、对局、最近对局）
- 本地目录：
  - `src/data/heroCatalog.js`
  - `src/data/itemCatalog.js`
- 本地素材：
  - `public/assets/heroes/`
  - `public/assets/items/`

## 项目结构

```text
.
├── docs/
│   ├── PROJECT_PLAN.md
│   └── FRONTEND_BACKEND_BOUNDARY.md
├── scripts/
│   ├── syncHeroes.mjs
│   └── syncItems.mjs
├── src/
│   ├── components/
│   ├── data/
│   ├── i18n/
│   ├── services/
│   ├── utils/
│   ├── App.jsx
│   └── styles.css
└── package.json
```

## 文档

- 产品与里程碑：`docs/PROJECT_PLAN.md`
- 前后端边界：`docs/FRONTEND_BACKEND_BOUNDARY.md`
- 协作规范：`AGENTS.md`

## 提交前检查

```bash
npm run lint
npm run build
```
