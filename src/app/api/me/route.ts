import { eq } from "drizzle-orm";
import { z } from "zod";
import { json, requireUserId, route } from "@/lib/api";
import { db, schema } from "@/lib/db";

const Body = z.object({ nickname: z.string().trim().min(1).max(20) });

export const PATCH = route(async (req) => {
  const userId = await requireUserId();
  const { nickname } = await json(req, Body);
  await db.update(schema.users).set({ nickname }).where(eq(schema.users.id, userId));
  return { nickname };
});
