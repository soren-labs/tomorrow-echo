# Frontend delivery notes

分支 `devin/frontend` · Next.js 16 App Router · React 19 · Tailwind 4 · Better Auth React client。

## 范围

| 路径 | 内容 |
| --- | --- |
| `/` | 产品介绍、静态示例卡片、登录/注册入口 |
| `/login`、`/signup` | 邮箱密码登录注册（`src/components/auth-form.tsx`），中文错误提示，成功进入 `/app` |
| `/app` | 私人信箱：统计摘要、状态筛选、新建预测表单、卡片列表、结算表单 |

## 结构

- `src/lib/auth-client.ts` — `createAuthClient`（better-auth/react），同源默认 baseURL；页面用 `useSession()` 守卫，未登录重定向 `/login`。
- `src/components/api.ts` — 按 `docs/CONTRACT.md` 封装的 `fetch` 封装；错误统一抛 `ApiRequestError{status, code}`。
- `src/components/capsule-utils.ts` — 纯函数：状态/延时常量、校验（标题 1–120、说明 ≤1000、概率 0–100 整数、复盘 ≤500、固定四档延时）、倒计时格式化、`serverNow` 时钟偏移、错误文案映射。
- `src/components/inbox.tsx` — 编排：会话守卫、列表+统计拉取、倒计时归零自动 `refresh()`（以服务器 `serverNow` 校正本地时钟）、创建/结算、401→登录、409→提示并刷新。
- `src/components/capsule-card.tsx` / `resolve-panel.tsx` / `capsule-form.tsx` / `filter-tabs.tsx` / `stats-bar.tsx` / `postmark.tsx` — 展示与表单组件；卡片为纯展示，动作区由父级注入。
- `src/app/globals.css` — Tailwind `@theme` 设计令牌：米白信纸底、深墨文字、青绿主色、朱砂邮戳色；`.btn`/`.input`/`.chip`/`.sheet` 组件类；`:focus-visible` 键盘焦点环。

## 设计

信封/信纸视觉：浅米白底 + 极淡横线纹理，朱砂色 SVG 邮戳（环形「明日回声 · TOMORROW ECHO」+ 日期）盖在卡片右上，圆形单字印（回/封/等/算）作签名元素。移动端单列，≥768px 双列卡片网格。

## 行为约定

- 倒计时按 `serverNow` 与本地时钟的偏移校正；归零后自动重新拉取列表与统计（≥4s 防抖，直到服务端翻转为 ready）。
- 封存中卡片渲染禁用按钮并给出剩余时间原因；待结算卡片内嵌结算表单；重复提交由 `resolvingId` 单飞锁防双击。
- 平均得分无已结算数据显示「暂无」。
- 所有错误经 `describeApiError` 映射为固定中文文案，不展示原始服务端/数据库报错。

## 测试

```
npm run typecheck   # tsc --noEmit，通过
npm run build       # next build，通过（7 页全部静态预渲染）
npm run lint        # eslint，0 error（postcss.config.mjs 的匿名导出 warning 为根配置固有）
npx vitest run tests/frontend   # 19 passed（校验、倒计时、时钟偏移、错误映射、fetch 封装）
```

UI 取证（浏览器 mock 仅存在于测试夹具）：

```
npm run build && npm run start -- -p 3100 &
node tests/frontend/capture-ui.mjs http://localhost:3100 artifacts/screenshots
# 输出 1440/390 两档 × /, /login, /app 截图到 artifacts/screenshots/（gitignored）
```

## 集成备注

- 依赖 `GET/POST /api/capsules`、`POST /api/capsules/:id/resolve`、`GET /api/stats`、`/api/auth/*`（Better Auth catch-all）。本分支未实现也不 mock 这些路由。
- 前端无环境变量需求；不读取 `DATABASE_URL`/`BETTER_AUTH_*`。
- `src/contracts.ts`、根依赖与配置未改动；未新增依赖。
- 已知限制：Better Auth 具体错误码以后端挂载版本为准，`describeAuthError` 未匹配的码落到通用提示。
