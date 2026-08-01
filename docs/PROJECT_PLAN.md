# DotaLens 产品规划文档（PRD）

## 1. 文档信息

- 产品名称：DotaLens
- 文档类型：当前版本范围 + 后续里程碑
- 当前版本：v2.0（按仓库现状同步）
- 更新时间：2026-07-31
- 适用仓库：`React 19 + Vite 8` 单页前端项目

## 2. 当前产品状态（已实现）

### 2.1 信息架构

- 四组工作台：
  - `首页`：总览
  - `比赛`：最近比赛
  - `提升`：英雄池、队友、趋势
  - `资料库`：全英雄、全物品

### 2.2 核心能力

- 查询入口：当前支持 `Steam32` 数字 ID。
- 账号管理：最多 5 个账号本地保存、切换、移除与持久化恢复。
- 时间窗口：`30 / 365` 天。
- 总览摘要：
  - 总场次、综合胜率、天辉/夜魇胜率
  - 平均 KDA、平均 GPM/XPM
  - 最佳/最差/最常玩/绝活/又菜又爱玩英雄
  - 最长连胜、最长连败、暴走次数、超神次数
  - 最多同队队友、最强队友、最坑队友
  - 段位分布、比赛模式分布、关键场次极值
- 趋势分析：
  - 日胜率趋势
  - 日 KDA 趋势
  - 日 GPM/XPM 双曲线
  - 按小时活跃时段分布
- 英雄池分析：
  - 排序（影响力、属性、场次、胜率、KDA、GPM、XPM、名称）
  - 主属性筛选
  - 最少场次过滤
  - CSV 导出
  - 行展开查看该英雄窗口内比赛
- 队友协同：
  - 基于 `/players/{accountId}/peers`
  - 同队场次、同队胜率、对位胜率、最近遇到时间
  - 排序、摘要卡、空态兜底
- 最近比赛：
  - 最近比赛分页展示
  - 汇总指标（胜率、平均 KDA、平均 GPM、平均时长）
  - 点击任意比赛进入详情抽屉
- 对局详情抽屉：
  - 基础概览（模式、队列、KDA、KP、暴走/超神等）
  - 个人核心数据（伤害、治疗、经济、等级）
  - 出装终局、购买时间线、中立装
  - 技能加点时间线
  - 全场 10 人面板
- 本地目录浏览：
  - 全英雄：属性分类、基础面板、定位信息
  - 全物品：规则分类、图标目录
- 国际化：`zh / en` 双语。
- 可执行洞察：使用带版本号、样本量、置信度和证据的 `coach:v1` 规则。

### 2.3 鲁棒性

- 请求取消：保留 `AbortController`。
- 错误映射：404 / 429 / 其他 HTTP 状态本地化提示。
- 空数据场景：返回可渲染空态数据，不让页面直接失败。
- 示例数据：静态样本始终明确标注，只由用户主动浏览，不会静默替代失败的真实查询。
- 缓存与请求：原始响应按 TTL 去重，详情缓存有 LRU 上限，请求支持取消、20 秒超时和精确失效。
- 数据覆盖：未知赛果、缺失 KDA/时长、可选资源失败均保留覆盖口径，不参与相应分母。

## 3. 数据与架构基线

### 3.1 分层职责

- `src/App.jsx`
  - 管理查询、账号、tab、筛选、分页、抽屉等全局状态。
  - 调用 service，向组件下发 ViewModel。
- `src/services/opendotaClient.js`
  - 封装 OpenDota 请求。
  - 处理 HTTP 错误与请求参数兜底。
  - 维护英雄/物品元数据缓存。
- `src/services/opendota.js`
  - 聚合窗口比赛、最近比赛、段位分布、队友关系、详情 ViewModel。
  - 负责无数据分支和字段容错。
- `src/utils/metrics.js`
  - 纯计算与摘要生成。
- `src/components/*`
  - 纯展示组件，无请求副作用。

### 3.2 当前核心数据契约

`fetchPlayerWindowAnalytics(accountId, days, signal, lang)` 返回：

- `playerName`
- `playerAvatar`
- `heroPerformance[]`
- `dailyWinRate[]`
- `dailyKdaTrend[]`
- `dailyGpmTrend[]`
- `dailyXpmTrend[]`
- `rankDistribution[]`
- `recentMatches[]`
- `windowMatches[]`
- `metrics`
- `achievementTotals`
- `teammates[]`
- `teammateSummary`
- `totalMatches`
- `outcomeMatches` / `unknownOutcomeMatches`
- `latestMatchStartTime`
- `dataCoverage` / `accessIssues` / `status`

`fetchRecentMatchDetail(accountId, matchId, signal, lang, fallback)` 返回：

- `matchId`
- `heroId` / `hero` / `heroAvatar`
- `overview`
- `core`
- `build`
- `allPlayers[]`

## 4. 版本里程碑

### M1（已完成）

- 基础 Steam32 查询链路。
- 胜率/英雄/段位基础分析。
- 中英文切换、错误提示、明确标注的示例数据。

### M2（已完成）

- Tab 化工作台。
- 最近比赛面板与详情抽屉。
- 英雄池排序/筛选/导出/展开。
- 本地多账号管理。

### M3（已完成）

- 全英雄/全物品目录与同步脚本。
- 365 天窗口。
- 总览卡片补全（连胜连败、暴走/超神等）。

### M4（已完成）

- 队友协同页。
- GPM/XPM 趋势与活跃时段统计。
- peers 公开历史统计与其上游 `last_played` 最近遇到时间。

### M5（下一阶段）

- URL 状态同步（tab / days / account）。
- 最近比赛高级筛选（胜负、英雄、模式、段位区间）。
- 总览中的分路分布恢复或重设计。

### M6（中期）

- Hero 详情专题页（单英雄趋势、对线样本、构建偏好）。
- 双账号对比（自己 vs 固定队友/对手）。
- 分享与导出增强（截图、可分享链接、导出报告）。

## 5. 验收标准

### 5.1 工程检查

- `npm run lint` 通过。
- `npm run test:coverage` 通过。
- `npm run build` 通过。
- `npm run check:budget` 通过。

### 5.2 功能回归

- Steam32 数字输入可发起查询，非法输入有正确报错。
- 账号新增、切换、移除、刷新恢复正确。
- 30/365 天切换后，总览、趋势、英雄池、队友、最近比赛同步更新。
- 最近比赛与英雄展开明细均可进入详情抽屉。
- 中英文文案完整，无明显缺失 key。
- `<=980px`、`<=640px` 下表格、抽屉、tab 区域不破版。

## 6. 风险与应对

- OpenDota 限流或抖动：保留结构化错误、`Retry-After` 倒计时与可恢复空态，并允许用户主动查看示例。
- 玩家历史对局过多：比赛窗口采用分页拉取与去重，避免单次截断。
- 接口字段不稳定：在 service 层统一做容错与默认值。
- 文案增量遗漏：要求 `zh/en` 同步维护。

## 7. 非目标（当前阶段）

- 不引入重型状态管理库。
- 不迁移 TypeScript。
- 不重构 Vite / ESLint 工具链。
