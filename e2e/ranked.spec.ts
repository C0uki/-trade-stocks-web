import { expect, test, type Page, type Response } from "@playwright/test";

/**
 * ランク戦を最初から最後まで通す。
 * 終了前に API が返した中身に、実日付（YYYY-MM-DD）や指数化の基準値が含まれないことも確かめる。
 */

const REAL_DATE = /"(19|20)\d\d-\d\d-\d\d/;

async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("名前（英数字）").fill(name);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page).toHaveURL("/");
}

test("ランク戦：注文 → 進行 → 終了 → 結果とランキング", async ({ page }) => {
  const leaks: string[] = [];
  let finished = false;
  page.on("response", async (res: Response) => {
    if (!res.url().includes("/api/scenarios") || finished) return;
    const body = await res.text().catch(() => "");
    if (REAL_DATE.test(body) || body.includes("basePriceJpy")) leaks.push(res.url());
  });

  await login(page, `e2e-${Date.now()}`);
  await page.getByRole("button", { name: "ランク戦を始める" }).click();
  await expect(page).toHaveURL(/\/play\//);
  await expect(page.getByTestId("day")).toHaveText("0 / 250 日目");
  const scenarioUrl = page.url();
  const id = scenarioUrl.split("/play/")[1];

  // 一覧の先頭の銘柄を100万円分買う
  const first = page.getByTestId("market-list").locator("button").first();
  const firstName = (await first.locator("span.font-medium").textContent())?.trim() ?? "";
  await first.click();
  await expect(page.getByTestId("instrument-name")).toHaveText(firstName);
  await page.getByRole("button", { name: "¥1,000,000" }).click();
  await page.getByTestId("submit-order").click();
  await expect(page.getByText("注文を受け付けました")).toBeVisible();
  await page.getByRole("tab", { name: /注文中/ }).click();
  await expect(page.getByTestId("orders").locator("tbody tr")).toHaveCount(1);

  // 翌日の始値で約定する（休場日に当たったら約定するまで進める）
  await page.getByTestId("next1").click();
  await expect(page.getByTestId("day")).toHaveText("1 / 250 日目");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("tab", { name: /保有/ }).click();
    if ((await page.getByTestId("positions").count()) > 0) break;
    await page.getByTestId("next1").click();
  }
  await expect(page.getByTestId("positions").locator("tbody tr")).toHaveCount(1);
  await expect(page.getByTestId("cash")).not.toHaveText("¥10,000,000");

  // 残りは API で早送りし、最後の1週間だけ画面から進める
  const state = await (await page.request.get(`/api/scenarios/${id}`)).json();
  let day: number = state.currentDay;
  while (day < 245) {
    const r = await page.request.post(`/api/scenarios/${id}/advance`, { data: { steps: Math.min(5, 245 - day) } });
    expect(r.ok()).toBeTruthy();
    day = (await r.json()).currentDay;
  }
  await page.reload();
  await expect(page.getByTestId("day")).toHaveText("245 / 250 日目");
  await expect(page.getByTestId("instrument-name")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/play.png", fullPage: true });

  finished = true;
  await page.getByTestId("next5").click();
  await expect(page).toHaveURL(/\/result\//);
  await expect(page.getByTestId("score")).toContainText("pt");
  await expect(page.getByTestId("period")).toContainText(/\d{4}-\d{2}-\d{2}/);
  await page.screenshot({ path: "test-results/result.png", fullPage: true });

  expect(leaks, `実日付・基準値が漏れたレスポンス: ${leaks.join(", ")}`).toEqual([]);

  // 終了後は同じ API で実日付が見える
  const after = await (await page.request.get(`/api/scenarios/${id}`)).json();
  expect(after.revealed).toBe(true);
  expect(after.period.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  await page.goto("/ranking");
  await expect(page.getByRole("heading", { name: "月間ランキング" })).toBeVisible();
});

test("ランク戦は同時に1本まで", async ({ page }) => {
  await login(page, `e2e-dup-${Date.now()}`);
  const a = await page.request.post("/api/scenarios", { data: { mode: "ranked" } });
  expect(a.ok()).toBeTruthy();
  const b = await page.request.post("/api/scenarios", { data: { mode: "ranked" } });
  expect(b.status()).toBe(409);
});

test("他人のシナリオは見られない", async ({ page, browser }) => {
  await login(page, `e2e-owner-${Date.now()}`);
  const { id } = await (await page.request.post("/api/scenarios", { data: { mode: "practice" } })).json();
  const other = await browser.newPage();
  await login(other, `e2e-other-${Date.now()}`);
  expect((await other.request.get(`/api/scenarios/${id}`)).status()).toBe(404);
  expect((await other.request.post(`/api/scenarios/${id}/advance`, { data: { steps: 1 } })).status()).toBe(404);
  await other.close();
});

test("練習モード：期間を指定すると実日付が見える", async ({ page }) => {
  await login(page, `e2e-practice-${Date.now()}`);
  await page.goto("/practice");
  await page.locator('input[type="date"]').fill("2020-02-03");
  await page.getByRole("button", { name: "練習を始める" }).click();
  await expect(page).toHaveURL(/\/play\//);
  await expect(page.getByText("2020-02-03")).toBeVisible();
});

test("ランク戦の放棄は -20pt 以下、練習モードの放棄は補正しない", async ({ page }) => {
  await login(page, `e2e-abandon-${Date.now()}`);
  for (const mode of ["ranked", "practice"] as const) {
    const { id } = await (await page.request.post("/api/scenarios", { data: { mode } })).json();
    // 現金のまま1日進めてから放棄（補正がなければ、市場が下がった日はプラスのスコアになる）
    expect((await page.request.post(`/api/scenarios/${id}/advance`, { data: { steps: 1 } })).ok()).toBeTruthy();
    expect((await page.request.post(`/api/scenarios/${id}/abandon`)).ok()).toBeTruthy();
    const v = await (await page.request.get(`/api/scenarios/${id}`)).json();
    expect(v.status).toBe("abandoned");
    expect(v.result.finalValue).toBe(10_000_000);
    const raw = (v.result.finalValue / 10_000_000 - v.result.benchmarkValue / 10_000_000) * 100;
    if (mode === "ranked") {
      expect(v.result.score).toBeCloseTo(Math.min(raw, -20), 6);
      await page.goto(`/result/${id}`);
      await expect(page.getByTestId("abandon-note")).toBeVisible();
    } else {
      expect(v.result.score).toBeCloseTo(raw, 6);
    }
  }
});
