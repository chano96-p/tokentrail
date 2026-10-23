import { loadConfig } from "@/core/config";
import { getDb } from "@/server/db";
import { getSessionDetail } from "@/server/queries/sessionDetail";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[id]">,
) {
  const { id } = await ctx.params;
  const detail = await getSessionDetail(getDb(), id, loadConfig());
  if (!detail) {
    return Response.json(
      { error: "세션을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
  return Response.json(detail);
}
