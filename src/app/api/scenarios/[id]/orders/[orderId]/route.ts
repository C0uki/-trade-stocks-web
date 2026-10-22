import { requireUserId, route } from "@/lib/api";
import { cancelOrder } from "@/lib/game/service";

export const DELETE = route(async (_req, ctx: RouteContext<"/api/scenarios/[id]/orders/[orderId]">) => {
  const { id, orderId } = await ctx.params;
  await cancelOrder(id, await requireUserId(), orderId);
});
