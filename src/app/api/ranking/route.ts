import { route } from "@/lib/api";
import { GameError } from "@/lib/game/errors";
import { currentSeason, isSeason, seasonRanking } from "@/lib/game/ranking";

export const GET = route(async (req) => {
  const season = new URL(req.url).searchParams.get("season") ?? currentSeason();
  if (!isSeason(season)) throw new GameError(400, "シーズンは YYYY-MM で指定してください");
  return { season, rows: await seasonRanking(season) };
});
