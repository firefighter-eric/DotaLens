# DotaLens 前后端逻辑边界说明

> 说明：本仓库仍是纯前端项目。这里的“后端逻辑”指数据调用与聚合层（`services`），用于和 UI 展示层解耦，保证调用 OpenDota 的逻辑可验证、可替换。

## 1. 分层结果

### 前端展示层（UI）
- `src/App.jsx`
- `src/components/*`
- `src/i18n/copy.js`
- `src/styles.css`

职责：
- 输入校验与交互状态（loading / error / tab / filter）。
- 只消费 ViewModel（`playerName`、`heroPerformance`、`dailyWinRate` 等）。
- 不直接发 OpenDota 请求。

### 后端调用层（Data Client）
- `src/services/opendotaClient.js`

职责：
- 统一请求 OpenDota API。
- 统一处理 HTTP 错误（404 / 429 / 其他状态码）。
- 统一做请求参数兜底（`days`、`limit`）。
- 统一做原始响应规范化（数组兜底、英雄缓存）。
- 统一控制 OpenDota 查询策略（当前对局查询固定带 `significant=0`，避免默认过滤导致数据偏少）。

### 后端业务层（Domain Aggregation）
- `src/services/opendota.js`
- `src/utils/metrics.js`

职责：
- 基于 client 返回的原始数据做聚合计算：
  - `dailyWinRate`
  - `heroPerformance`
  - `rankDistribution`
  - `metrics` 汇总
- 输出前端稳定消费的 ViewModel。
- 处理“窗口内无对局”分支（返回空数据 + `latestMatchStartTime`）。

## 2. 当前调用链路

1. `App.jsx` 调用 `fetchPlayerWindowAnalytics(accountId, days, signal, lang)`。
2. `opendota.js` 创建 `createOpenDotaClient(lang)`。
3. `opendotaClient.js` 请求：
   - `/players/{accountId}`
   - `/players/{accountId}/matches?date={days}`
   - `/heroes`
4. `opendota.js` 聚合后返回 ViewModel 给 UI。

## 3. 为什么这样拆

- 防止 UI 组件掺杂请求细节，降低回归风险。
- 同一错误映射只维护一处（client 层）。
- 后续若迁移到真实后端（Node/BFF），只需替换 client，UI 与聚合层可基本不动。

## 4. 后端逻辑正确性检查（你关心的数据调用）

每次改动 `services` 后，最少执行：

```bash
npm run lint
npm run build
```

建议联调检查：

1. 输入存在账号且有近期战绩，应返回非空统计。
2. 输入存在账号但近期无战绩，应显示空态且带最近一场时间。
3. 输入不存在账号，应收到 404 本地化错误。
4. 高频请求触发限流时，应收到 429 本地化错误。
5. 切换 7/14/30 天，统计要同步变化。

## 5. 约束（后续开发）

- 新增 OpenDota 接口时，先加到 `opendotaClient.js`，再由 `opendota.js` 消费。
- 不在 UI 组件中直接 `fetch`。
- 统计计算保持在 `services` / `utils`，避免塞进 JSX。
