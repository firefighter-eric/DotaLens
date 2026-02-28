# DotaLens 产品规划文档（PRD）

## 1. 文档信息
- 产品名称：DotaLens
- 文档类型：产品规划 + 研发落地计划
- 当前版本：v1.1（Tab 化信息架构规划版）
- 更新时间：2026-03-01
- 适用范围：`docs/PROJECT_PLAN.md` 对应当前 React + Vite 前端仓库

## 2. 产品愿景与目标
### 2.1 愿景
为 Dota 玩家提供「可快速定位问题、可持续复盘」的数据分析体验，而不是一次性看图表。

### 2.2 业务目标（90 天）
- 查询成功率（有结果或可解释失败）>= 95%。
- 关键功能触达率（至少浏览 2 个 Tab）>= 65%。
- 二次访问率（7 日内）>= 25%。

### 2.3 产品目标（当前阶段）
- 将当前单页长内容升级为 Tab 化体验，降低信息密度压力。
- 在不引入重型框架的前提下，扩展复杂功能（筛选、排序、导出、对比）。
- 保持中英文一致、错误状态可解释、移动端可用。

## 3. 用户画像与核心任务
### 3.1 用户画像
- 上分型玩家：关心近期状态、英雄池是否健康。
- 复盘型玩家：关心输局原因、分路习惯、对局段位质量。
- 内容创作者：关心可截图、可导出、可讲述的数据结构。

### 3.2 核心任务（JTBD）
- 当我输入 ID 后，我希望先看到关键结论，再按主题深入。
- 当我切换时间窗口时，我希望所有图表和统计同步变化。
- 当数据为空或失败时，我希望知道「为什么」以及「下一步做什么」。

## 4. 信息架构（Tab 化）
> 目标：从「单页堆叠」升级为「分主题浏览」，支持复杂功能分层落地。

### 4.1 一级结构
- Tab A `Overview`（概览）
- Tab B `Heroes`（英雄池）
- Tab C `Trend`（趋势）
- Tab D `Rank & Role`（段位与分路）
- Tab E `Matches`（对局明细，V2）

### 4.2 各 Tab 内容定义
- `Overview`
  - 卡片：总场次、胜率、平均 KDA、最佳英雄。
  - 结论区：自动生成 2-3 条摘要（如「近 14 天胜率上升」）。
  - 快捷入口：跳转到相关 Tab（例如「最佳英雄 -> Heroes」）。
- `Heroes`
  - 表格：英雄、主定位、场次、胜率、KDA、GPM、影响力。
  - 功能：排序（多列）、定位筛选、最少场次阈值、CSV 导出。
  - 交互：点击英雄进入 Hero Drawer（该英雄趋势、常见对线，V2）。
- `Trend`
  - 折线：日胜率趋势（已有能力延续）。
  - 扩展：7/14/30 天 + 自定义日期范围（V1）。
  - 辅助：异常点标注（连败/连胜区间，V1.5）。
- `Rank & Role`
  - 段位分布（已实现）。
  - 分路占比（来自 lane_role / roaming 推断，V1）。
  - 关联提示：高段位局与低段位局的英雄表现差异（V2）。
- `Matches`（V2）
  - 对局列表：时间、结果、英雄、KDA、时长、段位。
  - 快速筛选：胜/负、英雄、分路、段位区间。
  - 对局详情侧栏：关键事件时间线（V2.5）。

### 4.3 Tab 交互规则
- 桌面端：顶部固定 Tab 导航；切换不丢失查询条件。
- 移动端（<=640px）：横向可滚动 Tab；优先显示标题与关键数字。
- 状态保持：`activeTab`、`days`、筛选条件在同一状态源（`App.jsx`）维护。
- 无数据策略：Tab 级空态，不影响其它 Tab 可见性。

## 5. 功能范围与版本拆分
### 5.1 已实现（MVP，当前仓库）
- OpenDota ID / Steam32 查询与校验。
- 14/30 天窗口切换。
- 胜率趋势、英雄表现、段位分布。
- API 异常提示（404/429/其他状态）与空数据提示。
- mock 回退与中英文切换。

### 5.2 V1（本轮重点）
- 引入 Tab 容器与分模块渲染。
- 增加 7 天窗口与自定义日期范围。
- Heroes Tab：排序、筛选、导出。
- Rank & Role Tab：分路占比视图。
- URL 同步（可选）：`?tab=heroes&days=30`。

### 5.3 V2
- Matches Tab 明细列表与筛选。
- 英雄详情 Drawer（单英雄趋势、对局样本）。
- 双账号对比（自己 vs 队友 / 对手）基础版。

### 5.4 V2.5+
- 阵容克制分析。
- 装备与时间线分析。
- 分享视图（可生成截图卡片）。

## 6. 详细需求（按模块）
### 6.1 查询与输入模块
- 支持 ID 类型切换（Steam32 / OpenDota）。
- 非数字输入即时拦截，给出本地化错误文案。
- 同条件重复查询触发强制刷新（当前 `reloadKey` 机制延续）。

### 6.2 全局筛选模块
- 时间窗口：7/14/30/自定义。
- 全局筛选变更后，所有 Tab 数据统一重算。
- 计算逻辑优先放 `utils` / `services`，避免 JSX 内堆叠计算。

### 6.3 结果状态模块
- `loading`：按钮禁用 + 状态行提示。
- `error`：保留上次成功数据，可重试。
- `empty`：明确无公开对局，不视为系统异常。
- `mock`：标注数据来源，避免误解为真实账号数据。

### 6.4 国际化模块
- 所有新增文案必须同步 `zh` / `en`。
- 错误文案与空态文案必须双语一致可解释。
- 日期、数字格式按语言输出（如后续加入 Intl 格式化）。

## 7. 数据与技术方案
### 7.1 前端架构
- 技术栈：React 18 + Vite 5（ESM）。
- 状态建议：
  - `App.jsx`：查询态、全局筛选、`activeTab`。
  - `components`：纯展示与事件回调。
  - `services/opendota.js`：请求、聚合、错误映射。
  - `utils/metrics.js`：纯计算函数。

### 7.2 建议数据契约（前端 ViewModel）
```ts
type DashboardViewModel = {
  source: 'opendota' | 'mock';
  playerName: string;
  totalMatches: number;
  metrics: {
    totalMatches: number;
    overallWinRate: number;
    avgKda: string;
    bestHero: { hero: string; impact: number; avgGpm: number };
  };
  dailyWinRate: Array<{ day: string; value: number }>;
  heroPerformance: Array<{
    hero: string;
    role: string;
    matches: number;
    wins: number;
    avgKda: number;
    avgGpm: number;
    impact: number;
  }>;
  rankDistribution: Array<{ tier: string; ratio: number }>;
  roleDistribution?: Array<{ role: string; ratio: number }>; // V1 新增
};
```

### 7.3 API 与鲁棒性
- 保留 `AbortController` 取消请求能力。
- 404 / 429 / 其他 HTTP 错误需区分提示。
- 英雄列表接口做内存缓存（已有 `heroesCache`，继续沿用）。
- 无数据时返回业务空态，不直接崩溃页面。

### 7.4 性能策略
- 大表格排序与筛选使用 `useMemo`。
- Tab 按需渲染（只渲染激活 Tab，可选保活缓存）。
- 移动端优先减少一次性渲染节点数量。

## 8. 交互与视觉要求
- 保持当前设计语言，不引入 UI 框架。
- Tab 栏应具备当前态高亮与键盘可访问性（`role="tablist"`）。
- 断点要求：
  - `<=980px`：双栏退化为单栏。
  - `<=640px`：Tab 横向滚动、表格可横向滚动不破版。

## 9. 埋点与指标（建议）
- 事件：
  - `query_submitted`
  - `query_failed`
  - `tab_changed`
  - `filter_changed`
  - `export_clicked`
- 指标：
  - 查询成功率、平均首屏时间、Tab 渗透率、导出使用率。

## 10. 研发里程碑与交付物
### 里程碑 M1（1-2 天）
- 交付：Tab 容器、Overview/Heroes/Trend/Rank 四个 Tab 拆分完成。
- 验收：现有功能无回归，14/30 天切换稳定。

### 里程碑 M2（1-2 天）
- 交付：7 天窗口、自定义范围、Heroes 排序筛选导出。
- 验收：筛选与统计一致，移动端不破版。

### 里程碑 M3（2-3 天）
- 交付：Matches Tab（基础列表）+ URL 状态同步。
- 验收：支持分享链接恢复到指定 Tab 与窗口。

### 里程碑 M4（持续迭代）
- 交付：英雄详情 Drawer、对比分析、阵容克制。

## 11. 测试与验收清单
### 11.1 自动化与工程检查
- `npm run lint` 通过。
- `npm run build` 通过。

### 11.2 手动回归
- Steam32 / OpenDota ID 均可查询。
- 非数字输入提示正确且中英文一致。
- Tab 切换不丢失查询状态。
- 14/30（后续含 7/自定义）切换后各 Tab 同步更新。
- API 失败、空数据、mock 回退都可解释。
- `<=980px`、`<=640px` 下图表/表格/Tab 不破版。

## 12. 风险与应对
- API 限流与抖动：增加重试提示、短时缓存、降级到 mock。
- 单页复杂度升高：用 Tab 分治，按模块拆组件和状态。
- 新筛选引发计算膨胀：统一数据层聚合，避免每个组件重复计算。
- 多语言遗漏：PR 检查项加入 `copy.zh` 与 `copy.en` 同步校验。

## 13. 非目标（除非单独立项）
- 不引入重型状态管理库或 UI 框架。
- 不迁移 TypeScript。
- 不改动 Vite + ESLint 工具链基础结构。
