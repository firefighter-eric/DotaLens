# DotaLens 前后端逻辑边界说明

> 本仓库仍是纯前端项目。此处“后端逻辑”指数据调用与聚合层（`services`），用于与 UI 展示层解耦。

## 1. 分层定义

### 前端展示层（UI）

- `src/App.jsx`
- `src/components/*`
- `src/i18n/copy.js`
- `src/styles.css`

职责：

- 管理输入状态、tab 状态、筛选状态、抽屉状态。
- 仅消费 ViewModel，不直接拼装原始 API 响应。
- 不直接请求 OpenDota。

### 调用层（Data Client）

- `src/services/opendotaClient.js`

职责：

- 统一封装 OpenDota 请求。
- 统一处理 HTTP 错误（404 / 429 / 其他）。
- 参数兜底（`days`、`limit`）与数组返回兜底。
- 维护本地元数据缓存（英雄/物品目录）。

### 业务聚合层（Domain Aggregation）

- `src/services/opendota.js`
- `src/utils/metrics.js`

职责：

- 聚合并输出前端可直接消费的数据结构：
  - `heroPerformance`
  - `dailyWinRate`
  - `rankDistribution`
  - `recentMatches`
  - `windowMatches`
  - `metrics`
- 构建对局详情 ViewModel（overview/core/build/allPlayers）。
- 处理无数据分支，返回可渲染空态数据。

## 2. 当前调用链路

### 首页统计链路

1. `App.jsx` 调用 `fetchPlayerWindowAnalytics(accountId, days, signal, lang)`。
2. `opendota.js` 内部创建 `createOpenDotaClient(lang)`。
3. `opendotaClient.js` 请求：
   - `/players/{accountId}`
   - `/players/{accountId}/matches?date={days}&significant=0`
   - `/players/{accountId}/recentMatches`（失败时回退到 `matches?limit=`）
4. `opendota.js` 聚合并返回 dashboard ViewModel。

### 对局详情链路

1. 用户在最近对局或英雄展开列表点击某场对局。
2. `App.jsx` 调用 `fetchRecentMatchDetail(accountId, matchId, signal, lang, fallback)`。
3. `opendotaClient.js` 请求 `/matches/{matchId}`。
4. `opendota.js` 聚合玩家、出装、技能与全场面板后返回详情数据。

## 3. 本地目录与远端数据的边界

- 英雄/物品目录来源于本地文件：
  - `src/data/heroCatalog.js`
  - `src/data/itemCatalog.js`
- 同步脚本：
  - `scripts/syncHeroes.mjs`
  - `scripts/syncItems.mjs`
- 运行同步脚本后，本地静态资源更新到 `public/assets/heroes` 与 `public/assets/items`。

## 4. 约束（必须遵守）

- 新增 OpenDota 接口时，先扩展 `opendotaClient.js`，再由 `opendota.js` 消费。
- 不在 `components` 或 `App.jsx` 中直接 `fetch`。
- 统计与聚合逻辑保持在 `services` / `utils`，避免散落在 JSX。
- 错误映射和空态兜底必须在数据层完成，UI 只做展示。

## 5. 变更后检查

```bash
npm run lint
npm run build
```

建议功能回归：

1. 正常账号有数据时，dashboard 与 recent matches 均非空。
2. 窗口内无对局时，能看到可解释空态和最近对局时间提示。
3. 404/429/其他 HTTP 错误文案正确。
4. 对局详情抽屉在 API 成功与失败场景都可正确反馈。
