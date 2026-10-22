import { expect, test } from "@playwright/test";
import { ADMIN_NAME, issueInvite, login, uid } from "./helpers";

test("一般ユーザーは実データに触れない", async ({ page }) => {
  await login(page, uid("e2e-public"));
  await expect(page.getByRole("button", { name: "ランク戦を始める（架空銘柄）" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ランク戦を始める（実データ）" })).toHaveCount(0);
  expect((await page.request.post("/api/scenarios", { data: { mode: "ranked", dataset: "real" } })).status()).toBe(403);
  expect((await page.request.get("/api/ranking?dataset=real")).status()).toBe(403);
  expect((await page.request.get("/api/admin/invites")).status()).toBe(404);
  expect((await page.goto("/admin/invites"))?.status()).toBe(404);
});

test("管理者が画面で招待コードを発行し、受け取った人が設定画面で使うと身内になる", async ({ page, browser }) => {
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN_NAME);
  await admin.goto("/admin/invites");
  await admin.getByRole("button", { name: "コードを発行する" }).click();
  const code = (await admin.getByTestId("issued-code").textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  await login(page, uid("e2e-invitee"));
  await page.goto("/settings");
  // 小文字・ハイフンなしでも通る
  await page.getByLabel("招待コード").fill(code.toLowerCase().replace(/-/g, ""));
  await page.getByRole("button", { name: "コードを使う" }).click();
  await expect(page.getByTestId("insider")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("button", { name: "ランク戦を始める（実データ）" })).toBeVisible();

  // 同じコードは二度使えない
  const ctx2 = await browser.newContext();
  const second = await ctx2.newPage();
  await login(second, uid("e2e-second"));
  expect((await second.request.post("/api/invites/redeem", { data: { code } })).status()).toBe(400);

  // 管理画面では使用済みになっている
  await admin.reload();
  await expect(admin.getByRole("row", { name: new RegExp(code) })).toContainText("使用済み");
  await ctx2.close();
  await adminCtx.close();
});

test("取り消した招待コードは使えない", async ({ page, browser }) => {
  const code = await issueInvite(browser);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, ADMIN_NAME);
  expect((await admin.request.delete(`/api/admin/invites/${code}`)).ok()).toBeTruthy();
  await adminCtx.close();

  await login(page, uid("e2e-revoked"));
  expect((await page.request.post("/api/invites/redeem", { data: { code } })).status()).toBe(400);
  expect((await page.request.post("/api/scenarios", { data: { mode: "ranked", dataset: "real" } })).status()).toBe(403);
});
