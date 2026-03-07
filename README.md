# DotaLens

DotaLens 是一个基于 **React 18 + Vite 5** 的 Dota 数据分析前端工作台。项目直接消费 OpenDota 公共接口，并在真实数据不可用时回退到 mock 数据，保证页面仍可浏览和验证交互。

## 当前能力（2026-03）

- 查询入口：当前仅支持 `Steam32` 数字 ID 输入。
- 多账号管理：本地保存最多 5 个账号，支持登录、切换、移除与刷新后恢复。
- 时间窗口：`30 / 365` 天联动分析。
- Tab 工作台：
  - `最近比赛`：最近比赛分页浏览、汇总指标、可点选进入详情抽屉。
  - `英雄池`：排序、主属性筛选、最少场次过滤、CSV 导出、英雄行展开比赛明细。
  - `队友`：基于 OpenDota peers 的同队/对位统计、排序与摘要卡。
  - `趋势`：胜率、KDA、GPM/XPM、活跃时段四组趋势视图。
  - `总览`：关键结论、核心指标卡、段位分布、比赛模式分布。
  - `全英雄`：本地英雄目录与属性详情面板。
  - `全物品`：本地物品目录与分类浏览。
- 对局详情抽屉：基础概览、个人核心数据、出装时间线、技能加点、全场 10 人面板。
- 国际化：`zh / en` 双语文案。
- 错误处理：区分 404、429 与其他 HTTP 错误，并保留空态/示例态。

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
- `npm run sync:heroes`：同步英雄目录与头像资源
- `npm run sync:items`：同步物品目录与图标资源

## 数据与资源

- 在线数据：OpenDota API
  - 玩家资料 `/players/{accountId}`
  - 窗口比赛 `/players/{accountId}/matches`
  - 最近比赛 `/players/{accountId}/recentMatches`
  - 玩家计数 `/players/{accountId}/counts`
  - 常用队友 `/players/{accountId}/peers`
  - 对局详情 `/matches/{matchId}`
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

- 产品范围与里程碑：`docs/PROJECT_PLAN.md`
- 分层与调用边界：`docs/FRONTEND_BACKEND_BOUNDARY.md`
- 仓库协作规范：`AGENTS.md`

## 提交前检查

```bash
npm run lint
npm run build
```
