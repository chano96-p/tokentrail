import { GET as rawGET } from "@/app/api/sessions/[id]/events/[uuid]/raw/route";
import { POST as syncPOST } from "@/app/api/sync/route";
import { expect, test, vi } from "vitest";

test("demo 모드에서 sync와 raw는 403", async () => {
  vi.stubEnv("APP_MODE", "demo");
  expect((await syncPOST()).status).toBe(403);
  expect(
    (
      await rawGET(new Request("http://x"), {
        params: Promise.resolve({ id: "s1", uuid: "u1" }),
      })
    ).status,
  ).toBe(403);
});
