# DotaLens 前后端逻辑边界说明

> 本仓库仍是纯前端项目。此处“后端逻辑”特指数据请求与业务聚合层，即 `src/services/*` 与 `src/utils/*` 中承担服务端式职责的代码。

## 1. 分层定义

### 前端展示层（UI）

- `src/App.jsx`
- `src/components/*`
- `src/hooks/*`
- `src/i18n/copy.js`
- `src/styles.css`（入口）与 `src/styles/{tokens,components,accessibility,workspace}.css`；目录样式 `src/styles/catalog.css` 随目录页面按需加载。

职责：

- 管理输入状态、账号状态、tab、筛选、分页和抽屉状态。
- 仅消费已经聚合好的 ViewModel。
- 不直接请求 OpenDota。
- 不在 JSX 中拼装原始响应字段。

账号存取由 `useAccountSession` 管理；查询生命周期由 `usePlayerAnalytics` 管理；抽屉请求由 `useMatchDetail` 管理。`useWorkspacePreferences` 持久化语言并通过 URL hash 保存页签，支持刷新和浏览器前进/后退。`WorkspaceHeader` 与局部错误边界让导航在数据请求或页面渲染失败时仍然可用；目录不依赖玩家数据。

### 调用层（Data Client）

- `src/services/opendotaClient.js`

职责：

- 统一封装 OpenDota 请求入口。
- 统一处理 HTTP 错误（404 / 429 / 其他）。
- 参数兜底（如 `days`、`limit`）和数组/空值兜底。
- 处理窗口比赛分页拉取与去重。
- 维护有 TTL、去重、按资源失效与详情 LRU 上限的响应缓存。
- JSON 响应按声明长度和流式实收字节限制为 8 MiB；单页比赛最多 500 条。
- 头像仅接受 HTTPS Steam CDN 地址；缓存保留实际取数时间，命中缓存不会伪装为刚更新。

当前 client 暴露的主要接口：

- `getPlayer`
- `getPlayerPeers`
- `getMatchById`
- `getPlayerMatchesByDays`
- `getPlayerLatestMatches`
- `getHeroesMetaMap`
- `getItemMeta`
- `getAbilityNameById`

### 业务聚合层（Domain Aggregation）

- `src/services/opendota.js`
- `src/utils/metrics.js`

职责：

- 将原始接口数据聚合成前端可直接渲染的结构：
  - `heroPerformance`
  - `dailyWinRate`
  - `dailyKdaTrend`
  - `dailyGpmTrend`
  - `dailyXpmTrend`
  - `rankDistribution`
  - `recentMatches`
  - `windowMatches`
  - `achievementTotals`
  - `teammates`
  - `teammateSummary`
  - `metrics`
- 构建对局详情 ViewModel（`overview` / `core` / `build` / `allPlayers`）。
- 处理空数据、缺字段和回退逻辑。

## 2. 当前调用链路

### 窗口统计链路

1. `src/App.jsx` 通过 `usePlayerAnalytics` 调用 `fetchPlayerWindowAnalytics(accountId, days, signal, lang, { onProgress })`。
2. `src/services/opendota.js` 创建 `createOpenDotaClient(lang)`。
3. `src/services/opendotaClient.js` 请求：
   - `/players/{accountId}`
   - `/players/{accountId}/matches?date={days}&significant=0&limit=...&offset=...`
   - `/players/{accountId}/recentMatches`（可选切片，失败时返回明确的 `accessIssues`）
   - `/players/{accountId}/peers`
4. `fetchPlayerCoreAnalytics` 完成玩家和窗口统计后立即发布核心 ViewModel；最近对局与队友独立补齐，不阻塞核心统计。
5. 每个补充切片通过 `optionalSlices` 表示 loading/available/unavailable，失败保留 `accessIssues`，可以通过 `retrySlice` 单独重试。以查询键、请求序号及 AbortSignal 隔离旧请求；补充结果按切片合并，避免覆盖其他切片的重试结果。

### 最近比赛详情链路

1. 用户在最近比赛表格或英雄展开明细中点击某场比赛。
2. `useMatchDetail` 调用 `fetchRecentMatchDetail(accountId, matchId, signal, lang, fallback)`；示例详情由 `services/mockAnalytics.js` 构造。
3. `src/services/opendotaClient.js` 请求 `/matches/{matchId}`，并读取本地英雄/物品元数据。
4. `src/services/opendota.js` 聚合个人视角数据、出装、技能和全场玩家面板后返回详情数据。

### 队友协同链路

1. `fetchPlayerWindowAnalytics` 并发请求 `/players/{accountId}/peers` 与最近比赛。
2. `src/services/opendota.js` 直接按 peers 的公开历史口径构造协同统计与 `last_played`；不会伪装成 30/365 天窗口统计。
3. `src/App.jsx` 将 `teammates` 与 `teammateSummary` 传给 `TeammatesPanel`。

## 3. 本地目录与远端数据的边界

- 英雄/物品目录来自本地文件：
  - `src/data/heroCatalog.js`
  - `src/data/itemCatalog.js`
- 同步脚本：
  - `scripts/syncHeroes.mjs`
  - `scripts/syncItems.mjs`
- 同步结果写入本地静态资源目录：
  - `public/assets/heroes/`
  - `public/assets/items/`

规则：

- UI 渲染时优先消费本地目录和素材。
- `useItemCatalog` 负责惰性加载与重试，`CatalogTab`/`CatalogListPanel` 消费加载状态与目录数据；加载失败与真正的空目录采用不同界面。
- `useCatalogBrowser` 保存英雄与物品各自的搜索、分类、排序、选中项和详情状态；`utils/catalog.js` 统一目录 ViewModel、筛选及计数。英雄紧凑网格连续展示全目录，物品每批展示 48 项。
- OpenDota 仅提供比赛与玩家动态数据，不负责目录展示结构。

## 4. 约束（必须遵守）

- 新增 OpenDota 接口时，先扩展 `src/services/opendotaClient.js`，再由 `src/services/opendota.js` 消费。
- 不在 `src/components/*` 或 `src/App.jsx` 中直接 `fetch`。
- 统计与聚合逻辑保持在 `services` / `utils`，不要散落在 JSX。
- 错误映射、空态兜底、字段容错必须在数据层完成，UI 只做展示。
- 文案变化只放在 `src/i18n/copy.js`，且 `zh/en` 同步维护。

## 5. 变更后检查

```bash
npm run lint
npm run test:coverage
npm run build
npm run check:budget
```

建议功能回归：

1. 正常账号有数据时，总览、趋势、英雄池、队友、最近比赛均有合理内容。
2. 窗口内无对局时，仍能看到可解释空态和最近比赛提示。
3. 404、429、其他 HTTP 错误文案正确。
4. 对局详情抽屉在 API 成功与失败场景都能正确反馈。
5. 30/365 天窗口切换后，各模块同步刷新。
