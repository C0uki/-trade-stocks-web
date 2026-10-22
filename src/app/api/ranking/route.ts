import { auth } from "@/auth";
import { route } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { currentSeason, isSeason, seasonRanking } from "@/lib/game/ranking";

export const GET = route(async (req) => {
  const params = new URL(req.url).searchParams;
  const season = params.get("season") ?? currentSeason();
  const dataset = params.get("dataset") ?? "synthetic";
  if (!isSeason(season)) throw new GameError(400, "シーズンは YYYY-MM で指定してください");
  if (dataset !== "real" && dataset !== "synthetic") throw new GameError(400, "dataset は real か synthetic です");
  if (dataset === "real" && !(await auth())?.user?.isInsider) {
    throw new GameError(403, "実データのランキングは招待された人だけが見られます");
  }
  return { season, dataset, rows: await seasonRanking(season, dataset) };
});
