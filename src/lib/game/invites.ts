import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { GameError } from "./errors";
import { newInviteCode, normalizeInviteCode } from "./invite-code";

export async function createInvite(adminId: string): Promise<string> {
  const code = newInviteCode();
  await db.insert(schema.inviteCodes).values({ code, createdBy: adminId });
  return code;
}

export async function revokeInvite(code: string) {
  const res = await db
    .update(schema.inviteCodes)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.inviteCodes.code, code), isNull(schema.inviteCodes.usedAt), isNull(schema.inviteCodes.revokedAt)))
    .returning({ code: schema.inviteCodes.code });
  if (res.length === 0) throw new GameError(404, "取り消せる招待コードがありません");
}

export async function listInvites() {
  return db
    .select({
      code: schema.inviteCodes.code,
      createdAt: schema.inviteCodes.createdAt,
      usedAt: schema.inviteCodes.usedAt,
      revokedAt: schema.inviteCodes.revokedAt,
      usedBy: schema.users.nickname,
      usedByName: schema.users.name,
    })
    .from(schema.inviteCodes)
    .leftJoin(schema.users, eq(schema.users.id, schema.inviteCodes.usedBy))
    .orderBy(desc(schema.inviteCodes.createdAt))
    .limit(200);
}

/** 招待コードを使って身内になる。未使用かつ取り消されていないコードだけが1回だけ使える */
export async function redeemInvite(userId: string, input: string) {
  const code = normalizeInviteCode(input);
  await db.transaction(async (tx) => {
    const used = await tx
      .update(schema.inviteCodes)
      .set({ usedBy: userId, usedAt: new Date() })
      .where(and(eq(schema.inviteCodes.code, code), isNull(schema.inviteCodes.usedAt), isNull(schema.inviteCodes.revokedAt)))
      .returning({ code: schema.inviteCodes.code });
    if (used.length === 0) throw new GameError(400, "招待コードが正しくないか、すでに使われています");
    await tx.update(schema.users).set({ isInsider: true }).where(eq(schema.users.id, userId));
  });
}
