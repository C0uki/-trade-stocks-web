import { expect, test, type Page, type Response } from "@playwright/test";
import { becomeInsider, login, uid } from "./helpers";

/**
 * ランク戦を最初から最後まで通す（架空銘柄・実データの両方）。
 * API が返した中身に、実日付（YYYY-MM-DD）や指数化の基準値が含まれないことも確かめる。
 * 実データは終了まで、架空データは終了後も含めてずっと。
 */

const DATE = /"(19|20)\d\d-\d\d-\d\d/;

async function playToEnd(page: Page, dataset: "synthetic" | "real") {
  const leaks: string[] = [];
  let finished = false;
  page.on("response", async (res: Response) => {
    if (!res.url().includes("/api/scenarios") || (finished && dataset === "real")) return;
    const body = await res.text().catch(() => "");
    if (DATE.test(body) || body.includes("basePriceJpy")) leaks.push(res.url());
  });

  const label = dataset === "real" ? "ランク戦を始める（実データ）" : "ランク戦を始める（架空銘柄）";
  await page.getByRole("button", { name: label }).click();
  await expect(page).toHaveURL(/\/play\//);
  await expect(page.getByTestId("day")).toHaveText("0 / 250 日目");
  await expect(page.getByTestId("dataset")).toHaveText(dataset === "real" ? "実データ" : "架空銘柄");
  const id = page.url().split("/play/")[1];

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
  await page.screenshot({ path: `test-results/play-${dataset}.png`, fullPage: true });

  finished = true;
  await page.getByTestId("next5").click();
  await expect(page).toHaveURL(/\/result\//);
  await expect(page.getByTestId("score")).toContainText("pt");
  await page.screenshot({ path: `test-results/result-${dataset}.png`, fullPage: true });

  const after = await (await page.request.get(`/api/scenarios/${id}`)).json();
  expect(leaks, `実日付・基準値が漏れたレスポンス: ${leaks.join(", ")}`).toEqual([]);
  return after;
}

test("架空銘柄のランク戦：誰でも最後まで遊べて、結果は架空暦で表示", async ({ page }) => {
  await login(page, uid("e2e-syn"));
  const after = await playToEnd(page, "synthetic");
  await expect(page.getByTestId("period")).toContainText(/架空暦 \d+年目/);
  expect(after.revealed).toBe(false);
  expect(after.period).toBeNull();
  expect(after.fictionalPeriod.startYear).toBeGreaterThan(0);

  await page.goto("/ranking");
  await expect(page.getByRole("heading", { name: "月間ランキング" })).toBeVisible();
});

test("実データのランク戦：身内だけ遊べて、終了後に実日付が公開される", async ({ page, browser }) => {
  await login(page, uid("e2e-real"));
  await becomeInsider(page, browser);
  await page.goto("/");
  const after = await playToEnd(page, "real");
  await expect(page.getByTestId("period")).toContainText(/\d{4}-\d{2}-\d{2}/);
  expect(after.revealed).toBe(true);
  expect(after.period.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("ランク戦はデータごとに同時に1本まで", async ({ page, browser }) => {
  await login(page, uid("e2e-dup"));
  await becomeInsider(page, browser);
  const create = (dataset: string) => page.request.post("/api/scenarios", { data: { mode: "ranked", dataset } });
  expect((await create("synthetic")).ok()).toBeTruthy();
  expect((await create("real")).ok()).toBeTruthy();
  expect((await create("synthetic")).status()).toBe(409);
  expect((await create("real")).status()).toBe(409);
});

test("他人のシナリオは見られない", async ({ page, browser }) => {
  await login(page, uid("e2e-owner"));
  const { id } = await (await page.request.post("/api/scenarios", { data: { mode: "practice" } })).json();
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await login(other, uid("e2e-other"));
  expect((await other.request.get(`/api/scenarios/${id}`)).status()).toBe(404);
  expect((await other.request.post(`/api/scenarios/${id}/advance`, { data: { steps: 1 } })).status()).toBe(404);
  await ctx.close();
});

test("練習モード：実データは期間を指定すると実日付が見える、架空は日付を出さない", async ({ page, browser }) => {
  await login(page, uid("e2e-practice"));
  await becomeInsider(page, browser);
  await page.goto("/practice");
  // 画面がハイドレーションされる前に入力すると、React の状態に反映されない
  await page.waitForLoadState("networkidle");
  await page.locator('input[type="date"]').fill("2020-02-03");
  await page.getByRole("button", { name: "練習を始める" }).last().click();
  await expect(page).toHaveURL(/\/play\//);
  await expect(page.getByText("2020-02-03")).toBeVisible();

  const syn = await page.request.post("/api/scenarios", {
    data: { mode: "practice", dataset: "synthetic", startDate: "2010-01-04" },
  });
  expect(syn.status()).toBe(400);
});

test("ランク戦の放棄は -20pt 以下、練習モードの放棄は補正しない", async ({ page }) => {
  await login(page, uid("e2e-abandon"));
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
