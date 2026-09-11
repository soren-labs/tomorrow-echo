// UI 取证脚本（仅测试夹具，不属于应用代码）。
// 用法：先 `npm run build && npm run start -- -p 3100`，再
//   node tests/frontend/capture-ui.mjs [baseUrl] [outDir]
// 用 Playwright 路由拦截注入契约形状的假数据，截取 1440px / 390px 页面。

import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3100";
const outDir = process.argv[3] ?? "artifacts/screenshots";

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();

const session = {
  session: { id: "s1", token: "t", userId: "u1", expiresAt: iso(now + 86400000) },
  user: { id: "u1", name: "演示用户", email: "demo@example.com", emailVerified: false },
};

const capsules = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "今晚 23:00 前写完周报",
    note: "已经连续三周拖延了，这次把概率放低一点。",
    probability: 80,
    createdAt: iso(now - 3600_000),
    unlockAt: iso(now + 42_000),
    state: "sealed",
    outcome: null,
    reflection: null,
    resolvedAt: null,
    score: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "本周会发布新版客户端",
    note: null,
    probability: 65,
    createdAt: iso(now - 86400_000),
    unlockAt: iso(now - 60_000),
    state: "ready",
    outcome: null,
    reflection: null,
    resolvedAt: null,
    score: null,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    title: "今天下班前把那封邮件发出去",
    note: "拖了三天了，今天必须动手。",
    probability: 80,
    createdAt: iso(now - 2 * 86400_000),
    unlockAt: iso(now - 86400_000),
    state: "resolved",
    outcome: false,
    reflection: "没发出去，高估了自己下班前的行动力。",
    resolvedAt: iso(now - 80000_000),
    score: 36,
  },
];

const stats = { total: 3, sealed: 1, ready: 1, resolved: 1, averageScore: 36, serverNow: iso(now) };

const ok = (body, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function mockApi(page) {
  await page.route("**/api/auth/**", (route) => route.fulfill(ok(session)));
  await page.route("**/api/stats", (route) => route.fulfill(ok(stats)));
  await page.route("**/api/capsules", (route) => {
    if (route.request().method() === "GET") return route.fulfill(ok({ capsules, serverNow: iso(Date.now()) }));
    return route.fulfill(ok({ capsule: capsules[0], serverNow: iso(Date.now()) }, 201));
  });
  await page.route("**/api/capsules/*/resolve", (route) =>
    route.fulfill(ok({ capsule: { ...capsules[2] }, serverNow: iso(Date.now()) })),
  );
}

const browser = await chromium.launch();
const shots = [];
for (const viewport of [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  await mockApi(page);
  for (const path of ["/", "/login", "/app"]) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const file = `${outDir}/${viewport.name}${path === "/" ? "-home" : path.replace("/", "-")}.png`;
    await page.screenshot({ path: file, fullPage: path !== "/app" });
    shots.push(file);
    console.log("captured", file);
  }
  await page.close();
}
await browser.close();
console.log("done:", shots.join(", "));
