# AGENTS.md

本文件用于指导在 `DotaLens` 仓库内协作的 AI/自动化开发代理，目标是保证改动可维护、可验证、可回滚。

## 项目概览

- 技术栈：React 19 + Vite 8（纯前端项目，ESM）。
- 核心数据源：OpenDota API（`src/services/opendotaClient.js` + `src/services/opendota.js`）。
- 当前页面架构：Tab 化工作台（最近比赛、英雄池、队友、趋势、总览、全英雄、全物品）。
- 查询能力：当前仅支持 Steam32，时间窗口为 30/365 天。
- 关键交互：
  - 玩家档案弹窗新增/切换（最多 5 个 Steam32，本地持久化，不涉及 Steam 登录）；
  - 最近对局点击后打开详情抽屉（含全场玩家面板）；
  - 英雄池支持排序/筛选/最少场次/CSV 导出与行展开；
  - 队友页支持 peers 协同统计与最近遇到时间展示。
- 示例策略：默认无账号时可展示明确标注的静态示例（`src/data/mockDotaData.js`）；网络失败时显示真实错误与恢复入口，用户可主动切换到示例，不会静默伪装为真实数据。

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run test:coverage
npm run build
npm run check:budget
npm run preview
npm run sync:heroes
npm run sync:items
```

要求：提交前至少通过 `npm run lint`、`npm run test:coverage`、`npm run build` 与 `npm run check:budget`。

## 目录职责

- `src/App.jsx`：全局状态与页面编排（查询、账号、tab、筛选、分页、抽屉）。
- `src/services/opendotaClient.js`：OpenDota 请求封装、HTTP 错误映射、参数兜底。
- `src/services/opendota.js`：业务聚合（heroPerformance、daily trends、rankDistribution、recentMatches、teammates、detail ViewModel）。
- `src/utils/metrics.js`：纯计算函数（百分比、仪表盘、模式分布与最近比赛汇总）。
- `src/components/`：展示组件（无请求副作用）。
- `src/i18n/copy.js`：`zh/en` 文案与格式化函数。
- `src/data/heroCatalog.js` / `src/data/itemCatalog.js`：本地英雄/物品目录数据。
- `scripts/syncHeroes.mjs` / `scripts/syncItems.mjs`：目录与素材同步脚本。
- `docs/PROJECT_PLAN.md`：范围与里程碑。
- `docs/FRONTEND_BACKEND_BOUNDARY.md`：分层与调用链边界。

## 开发约束

- 文案改动必须同步维护 `zh` 与 `en` 两套文案。
- 新增统计逻辑优先放在 `utils` 或 `services`，避免把计算堆在 JSX。
- API 相关改动必须保留：
  - `AbortController` 取消请求能力；
  - 404/429/其他 HTTP 状态的清晰错误提示；
  - 无数据场景下的空态返回（而非抛异常导致页面不可用）。
- 不在展示组件内直接发请求。
- 保持移动端可用（重点检查 `<=980px`、`<=640px` 断点）。

## 推荐工作流

1. 先定位改动层级（`services` 取数、`utils` 计算、`components` 展示、`copy` 文案）。
2. 最小化改动范围，优先复用既有 ViewModel 字段结构。
3. 新增筛选/状态优先放在 `App.jsx`，通过 props 下发。
4. 涉及目录数据时，优先复用 `heroCatalog` / `itemCatalog` 与同步脚本。
5. 完成后运行 `npm run lint` 和 `npm run build`，再做手动回归。

## 手动回归清单

- Steam32 数字 ID 可正常发起查询。
- 非数字输入可得到正确报错。
- 账号弹窗内可新增、切换、移除账号；刷新后账号信息可恢复。
- 30/365 天切换后，总览/趋势/英雄池/队友/最近比赛同步变化。
- 最近比赛分页、点击行打开/关闭详情抽屉正常。
- 英雄池筛选、排序、最少场次与 CSV 导出正常。
- 队友页排序、摘要卡、最近遇到时间展示正常。
- 中英文切换后，状态文案、错误文案、抽屉文案均正确。
- 全英雄与全物品目录可正常分类浏览。
- `<=980px`、`<=640px` 下表格与抽屉不破版。

## 非目标（除非明确提出）

- 不引入重型状态管理库或 UI 框架。
- 不重构为 TypeScript。
- 不修改项目构建工具链（Vite + ESLint）基础结构。
