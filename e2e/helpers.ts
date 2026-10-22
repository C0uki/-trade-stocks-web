import { expect, type Browser, type Page } from "@playwright/test";

/** playwright.config.ts の ADMIN_EMAILS に入れてある管理者（テストログインのメールは「名前@dev.local」） */
export const ADMIN_NAME = "e2e-admin";

export async function login(page: Page, name: string) {
  await page.goto("/login");
  await page.getByLabel("名前（英数字）").fill(name);
  await page.getByRole("button", { name: "ログイン" }).last().click();
  await expect(page).toHaveURL("/");
}

/** 管理者として招待コードを1つ発行する（別のブラウザコンテキストでログインする） */
export async function issueInvite(browser: Browser): Promise<string> {
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await login(admin, ADMIN_NAME);
  const res = await admin.request.post("/api/admin/invites");
  expect(res.ok()).toBeTruthy();
  const { code } = await res.json();
  await ctx.close();
  return code;
}

/** ログイン中のユーザーを招待コードで身内にする */
export async function becomeInsider(page: Page, browser: Browser) {
  const code = await issueInvite(browser);
  const res = await page.request.post("/api/invites/redeem", { data: { code } });
  expect(res.ok()).toBeTruthy();
}

export const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
