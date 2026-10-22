import { requireAdmin, route } from "@/lib/api";
import { revokeInvite } from "@/lib/game/invites";

export const DELETE = route(async (_req, ctx: RouteContext<"/api/admin/invites/[code]">) => {
  await requireAdmin();
  const { code } = await ctx.params;
  await revokeInvite(decodeURIComponent(code));
});
