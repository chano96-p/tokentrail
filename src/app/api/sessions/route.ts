import { loadConfig } from "@/core/config";
import { getDb } from "@/server/db";
import { parseSessionListParams } from "@/server/params";
import { listSessions } from "@/server/queries/sessions";

export async function GET(request: Request) {
  const config = loadConfig();
  const sp = new URL(request.url).searchParams;
  const params = parseSessionListParams(sp, new Date(), config.timezone);
  return Response.json(await listSessions(getDb(), params));
}
