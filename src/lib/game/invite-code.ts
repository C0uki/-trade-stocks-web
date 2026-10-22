import { randomInt } from "node:crypto";

/** 見間違えやすい文字（0/O, 1/I/L）を除いた英数字 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 12;

export function newInviteCode(): string {
  let s = "";
  for (let i = 0; i < LENGTH; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** 入力の揺れ（小文字・空白・ハイフンの有無）を吸収する */
export function normalizeInviteCode(input: string): string {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === LENGTH ? `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}` : s;
}

/** 管理者は環境変数 ADMIN_EMAILS（カンマ区切り）で決める */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}
