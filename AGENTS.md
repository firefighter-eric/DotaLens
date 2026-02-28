# AGENTS.md

本文件用于指导在 `DotaLens` 仓库内协作的 AI/自动化开发代理，目标是保证改动可维护、可验证、可回滚。

## 项目概览

- 技术栈：React 18 + Vite 5（纯前端项目，ESM）。
- 核心数据源：OpenDota API（`src/services/opendota.js`）。
- 当前页面能力：玩家 ID 查询、14/30 天窗口切换、胜率趋势、英雄表现、段位分布、中英文切换。
- 回退策略：API 不可用时仍可展示 mock 数据（`src/data/mockDotaData.js`）。

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

要求：提交前至少通过 `npm run lint` 与 `npm run build`。

## 目录职责

- `src/App.jsx`：页面编排、查询状态、语言切换、错误状态与加载状态。
- `src/services/opendota.js`：API 请求、原始数据聚合与本地化错误映射。
- `src/utils/metrics.js`：纯计算函数（百分比、汇总指标等）。
- `src/components/`：展示组件（尽量保持无副作用）。
- `src/i18n/copy.js`：中英文文案与格式化函数。
- `src/styles.css`：全局样式与响应式布局。
- `docs/PROJECT_PLAN.md`：需求范围与里程碑说明。

## 开发约束

- 文案改动必须同步维护 `zh` 与 `en` 两套文案。
- 新增统计逻辑优先放在 `utils` 或 `services`，避免把计算堆在 JSX 内。
- API 相关改动要保留：
  - `AbortController` 取消请求能力；
  - 404/429/其他 HTTP 状态的清晰错误提示；
  - 无数据场景下的空态展示。
- 组件保持小而明确，避免在展示组件中发请求。
- 保持移动端可用（重点检查 `<=980px`、`<=640px` 断点）。

## 推荐工作流

1. 先定位改动层级（`services` 取数、`utils` 计算、`components` 展示、`copy` 文案）。
2. 最小化改动范围，优先复用现有类型/字段结构（如 `heroPerformance`、`dailyWinRate`、`rankDistribution`）。
3. 若新增筛选/状态，优先放在 `App.jsx`，并通过 props 下发给子组件。
4. 完成后运行 `npm run lint` 和 `npm run build`，再做手动回归。

## 手动回归清单

- 能用 Steam32 与 OpenDota ID 发起查询。
- 非数字输入可得到正确报错。
- 14/30 天切换后图表和统计同步变化。
- 中英文切换后，状态文案和错误文案都正确。
- 表格、趋势图、段位分布在窄屏下不破版。

## 非目标（除非明确提出）

- 不引入重型状态管理库或 UI 框架。
- 不重构为 TypeScript。
- 不修改项目构建工具链（Vite + ESLint）基础结构。
