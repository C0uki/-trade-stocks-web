import { z } from "zod";
import { json, requireUserId, route } from "@/lib/api";
import { redeemInvite } from "@/lib/game/invites";

const Body = z.object({ code: z.string().trim().min(1).max(40) });

export const POST = route(async (req) => {
  const userId = await requireUserId();
  const { code } = await json(req, Body);
  await redeemInvite(userId, code);
});
