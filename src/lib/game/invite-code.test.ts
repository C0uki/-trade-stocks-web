import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminEmail, newInviteCode, normalizeInviteCode } from "./invite-code";

describe("招待コード", () => {
  it("XXXX-XXXX-XXXX 形式で、見間違えやすい文字を含まない", () => {
    for (let i = 0; i < 200; i++) {
      const c = newInviteCode();
      expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(c).not.toMatch(/[01OIL]/);
    }
    expect(new Set(Array.from({ length: 200 }, newInviteCode)).size).toBe(200);
  });

  it("小文字・空白・ハイフンの揺れを吸収する", () => {
    expect(normalizeInviteCode(" abcd efgh-jkmn ")).toBe("ABCD-EFGH-JKMN");
    expect(normalizeInviteCode("ABCDEFGHJKMN")).toBe("ABCD-EFGH-JKMN");
    expect(normalizeInviteCode("short")).toBe("SHORT");
  });
});

describe("管理者の判定", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("ADMIN_EMAILS に含まれるメールだけが管理者（大文字小文字は区別しない）", () => {
    vi.stubEnv("ADMIN_EMAILS", "a@example.com, Boss@Example.com");
    expect(isAdminEmail("boss@example.com")).toBe(true);
    expect(isAdminEmail("a@example.com")).toBe(true);
    expect(isAdminEmail("c@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });

  it("未設定なら誰も管理者ではない", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(isAdminEmail("a@example.com")).toBe(false);
  });
});
