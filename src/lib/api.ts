import "server-only";
import { z } from "zod";
import { auth } from "@/auth";
import { GameError } from "@/lib/game/errors";

/** ログイン中のユーザー ID。未ログインなら 401 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new GameError(401, "ログインしてください");
  return id;
}

/** Route Handler の共通ラッパー：GameError と入力エラーを JSON で返す */
export function route<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<unknown>) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    try {
      const body = await fn(req, ctx);
      return Response.json(body ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof GameError) return Response.json({ error: e.message }, { status: e.status });
      if (e instanceof z.ZodError) {
        return Response.json({ error: "入力が正しくありません", issues: e.issues }, { status: 400 });
      }
      console.error(e);
      return Response.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
    }
  };
}

export async function json<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new GameError(400, "JSON を送ってください");
  }
  return schema.parse(raw);
}
