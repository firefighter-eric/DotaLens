# DotaLens

DotaLens 是一个基于 **React 19 + Vite 8** 的双语 Dota 2 数据分析前端工作台。项目直接消费 OpenDota 公共接口；真实数据失败时会保留明确错误与恢复入口，用户也可以主动浏览清晰标注的静态示例，二者不会混淆。

## 当前能力（2026-07）

- 查询入口：当前仅支持 `Steam32` 数字 ID 输入。
- 多玩家档案：当前浏览器最多保存 5 个 Steam32，支持切换、移除与刷新后恢复；不涉及 Steam 登录或密码。
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

需要 Node.js 24 LTS 与 npm 11。

```bash
nvm use
npm ci
npm run dev
```

开发地址固定为 `http://127.0.0.1:5175`。项目启用了严格端口模式：如果
5175 已被其他进程占用，Vite 会明确报错，而不会静默切换端口。这样可以
避免浏览器把同一玩家拆成多份 `localStorage`，导致看起来需要重新输入账号。

## 可用脚本

- `npm run dev`：开发模式
- `npm run lint`：ESLint 检查
- `npm test`：运行 Vitest 单元测试
- `npm run test:coverage`：运行测试与覆盖率门禁
- `npm run build`：生产构建
- `npm run check:budget`：检查生产包与静态资源预算
- `npm run audit:all`：检查生产和开发依赖漏洞
- `npm run check`：依次运行 lint、test、build 与资源预算
- `npm run preview`：本地预览构建结果
- `npm run sync:heroes`：同步英雄目录与头像资源
- `npm run sync:items`：同步物品目录与图标资源

## 数据与资源

- 在线数据：OpenDota API
  - 玩家资料 `/players/{accountId}`
  - 窗口比赛 `/players/{accountId}/matches`
  - 最近比赛 `/players/{accountId}/recentMatches`
  - 常用队友 `/players/{accountId}/peers`
  - 对局详情 `/matches/{matchId}`
- 本地目录：
  - `src/data/heroCatalog.js`
  - `src/data/itemCatalog.js`
- 物品上游目前没有经过验证的中文名称时，`nameZh` 明确保存为 `null`，界面回退显示英文；不会把英文伪装为中文翻译。
- 本地素材：
  - `public/assets/heroes/`
  - `public/assets/items/`
- 同步脚本仅访问白名单 HTTPS 源，并校验重定向、超时、体积、MIME 与图片文件签名；下载采用有界并发，先写入暂存目录，通过目录完整性检查后再原子发布，失败时保留旧快照。

可选构建变量见 `.env.example`：`VITE_OPENDOTA_API_BASE` 仅接受同源反向代理路径（如 `/api/opendota`）或 CSP 已允许的 OpenDota 官方 HTTPS 地址；其他来源会在构建阶段被拒绝。`VITE_APP_RELEASE` 用于宿主错误上报的发布标识。

## 项目结构

```text
.
├── docs/
│   ├── DEPLOYMENT.md
│   ├── PROJECT_PLAN.md
│   └── FRONTEND_BACKEND_BOUNDARY.md
├── tests/
├── scripts/
│   ├── checkBudgets.mjs
│   ├── syncHeroes.mjs
│   ├── syncItems.mjs
│   └── syncUtils.mjs
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
- 部署、发布与回滚：`docs/DEPLOYMENT.md`
- 仓库协作规范：`AGENTS.md`
- 贡献规范：`CONTRIBUTING.md`
- 安全报告：`SECURITY.md`
- 第三方资产声明：`NOTICE.md`

## 提交前检查

```bash
npm run lint
npm run test:coverage
npm run build
npm run check:budget
npm run audit:all
```
