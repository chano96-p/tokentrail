import { readRawLine } from "@/core/importer/raw";
import { getDb } from "@/server/db";
import { getAppMode } from "@/server/mode";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[id]/events/[uuid]/raw">,
) {
  if (getAppMode() === "demo") {
    return Response.json(
      { error: "데모에서는 원본 보기를 사용할 수 없습니다." },
      { status: 403 },
    );
  }

  const { id, uuid } = await ctx.params;

  const event = await getDb().timelineEvent.findUnique({
    where: { sessionId_uuid: { sessionId: id, uuid: uuid } },
    select: { sourceFile: { select: { path: true } } },
  });
  if (!event) {
    return Response.json(
      { error: "이벤트를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const line = await readRawLine(event.sourceFile.path, uuid);
  if (line === null) {
    return Response.json(
      { error: "원본 줄을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return Response.json({ line });
}
