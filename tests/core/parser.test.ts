import { parseLine } from "@/core/parser/parseLine";
import { expect, test } from "vitest";

function ok(line: string) {
  const r = parseLine(line);
  if (r.status !== "ok") throw new Error(`expected ok, got ${r.status}`);
  return r;
}

// 테스트용이라 느슨한 타입으로 둔다(필드를 지우거나 바꾸는 테스트가 있음).
function assistantLine(o: { id: string; uuid?: string; blocks?: unknown[] }) {
  return {
    type: "assistant",
    uuid: o.uuid ?? `u-${o.id}`,
    parentUuid: null,
    sessionId: "s1",
    cwd: "/Users/me/proj",
    gitBranch: "main",
    version: "2.0.0",
    timestamp: "2026-10-12T01:00:00Z",
    message: {
      id: o.id,
      model: "claude-a",
      role: "assistant",
      content: o.blocks ?? [{ type: "text", text: "hi" }],
      stop_reason: "end_turn",
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 20,
        cache_creation: {
          ephemeral_5m_input_tokens: 15,
          ephemeral_1h_input_tokens: 5,
        } as Record<string, number> | undefined,
      },
    },
  };
}

function userText(text: string, uuid?: string) {
  return {
    type: "user",
    uuid: uuid ?? "u0",
    parentUuid: null,
    sessionId: "s1",
    cwd: "/Users/me/proj",
    gitBranch: "main",
    version: "2.0.0",
    timestamp: "2026-10-12T01:00:00Z",
    message: {
      role: "user",
      content: text,
    },
  };
}

function userToolResult(o?: {
  content?: string;
  uuid?: string;
  is_error?: boolean;
}) {
  return {
    type: "user",
    uuid: o?.uuid ?? "u0",
    parentUuid: null,
    sessionId: "s1",
    cwd: "/Users/me/proj",
    gitBranch: "main",
    version: "2.0.0",
    timestamp: "2026-10-12T01:00:00Z",
    toolUseResult: { stdout: o?.content ?? "", stderr: "", exitCode: 0 },
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "t1",
          is_error: o?.is_error ?? false,
          content: o?.content ?? "",
        },
      ],
    },
  };
}

test("assistant 줄은 apiCall과 이벤트를 만든다", () => {
  const r = ok(
    JSON.stringify(
      assistantLine({
        id: "msg_1",
        blocks: [
          { type: "tool_use", name: "Bash", input: { command: "npm test" } },
        ],
      }),
    ),
  );
  expect(r.apiCall).toMatchObject({
    messageId: "msg_1",
    model: "claude-a",
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 100,
    cacheWrite5mTokens: 15,
    cacheWrite1hTokens: 5,
  });
  expect(r.events[0]).toMatchObject({
    kind: "tool_use",
    toolName: "Bash",
    inputSummary: "npm test",
    apiCallId: "msg_1",
  });
});

test("cache_creation이 없으면 cache write 전부를 5m로 본다", () => {
  const line = assistantLine({ id: "m0" });
  delete line.message.usage.cache_creation;
  expect(ok(JSON.stringify(line)).apiCall).toMatchObject({
    cacheWrite5mTokens: 20,
    cacheWrite1hTokens: 0,
  });
});

test("1h 키만 있으면 5m는 합계에서 채운다", () => {
  const line = assistantLine({ id: "m0" });
  line.message.usage.cache_creation = { ephemeral_1h_input_tokens: 5 };
  expect(ok(JSON.stringify(line)).apiCall).toMatchObject({
    cacheWrite5mTokens: 15,
    cacheWrite1hTokens: 5,
  });
});

test("TTL 합이 cache_creation_input_tokens보다 크면 합계를 기준으로 자른다", () => {
  const line = assistantLine({ id: "m0" });
  line.message.usage.cache_creation_input_tokens = 0;
  line.message.usage.cache_creation = {
    ephemeral_5m_input_tokens: 0,
    ephemeral_1h_input_tokens: 433,
  };
  expect(ok(JSON.stringify(line)).apiCall).toMatchObject({
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
  });
});

test("tool_result는 본문을 저장하지 않는다", () => {
  const r = ok(
    JSON.stringify(
      userToolResult({ content: "SECRET=abc".repeat(10), is_error: true }),
    ),
  );
  expect(r.events[0]).toMatchObject({
    kind: "tool_result",
    isError: true,
    contentLength: 100,
    preview: null,
  });
  expect(JSON.stringify(r)).not.toContain("SECRET");
});

test("user 문자열 프롬프트는 500자 미리보기", () => {
  const r = ok(JSON.stringify(userText("가".repeat(600))));
  expect(Array.from(r.events[0].preview!)).toHaveLength(501);
});

test("isMeta user, 모르는 타입은 ignored, 깨진 줄은 malformed", () => {
  expect(
    parseLine(JSON.stringify({ ...userText("x"), isMeta: true })).status,
  ).toBe("ignored");
  expect(
    parseLine(JSON.stringify({ type: "file-history-snapshot" })).status,
  ).toBe("ignored");
  expect(parseLine('{"type":"assi').status).toBe("malformed");
});

test("서브에이전트 줄은 agentId를 가진다", () => {
  const r = ok(
    JSON.stringify({
      ...assistantLine({ id: "m2", blocks: [{ type: "text", text: "hi" }] }),
      agentId: "a1",
    }),
  );
  expect(r.apiCall!.agentId).toBe("a1");
  expect(r.events[0].agentId).toBe("a1");
});

test("ai-title 줄은 제목만 준다", () => {
  expect(
    parseLine(
      JSON.stringify({
        type: "ai-title",
        aiTitle: "세션 제목",
        sessionId: "s1",
      }),
    ),
  ).toMatchObject({
    status: "ok",
    sessionId: "s1",
    title: "세션 제목",
    context: null,
    apiCall: null,
    events: [],
  });
});

test("블록이 여러 개면 uuid에 #index를 붙인다", () => {
  const r = ok(
    JSON.stringify(
      assistantLine({
        id: "m3",
        uuid: "u1",
        blocks: [
          { type: "thinking", thinking: "abc" },
          { type: "text", text: "ok" },
        ],
      }),
    ),
  );
  expect(r.events.map((e) => e.uuid)).toEqual(["u1", "u1#1"]);
  expect(r.events[0]).toMatchObject({
    kind: "thinking",
    contentLength: 3,
    preview: null,
  });
});

test("system 줄은 subtype과 에러 여부만 남긴다", () => {
  const r = ok(
    JSON.stringify({
      type: "system",
      uuid: "u9",
      sessionId: "s1",
      cwd: "/p",
      timestamp: "2026-10-12T01:00:00Z",
      subtype: "stop_hook_summary",
      level: "error",
      content: "body",
    }),
  );
  expect(r.events[0]).toMatchObject({
    kind: "system",
    preview: "stop_hook_summary",
    isError: true,
  });
  expect(JSON.stringify(r)).not.toContain("body");
});

test("필수 필드가 없거나 timestamp가 깨지면 malformed", () => {
  const { cwd: _cwd, ...noCwd } = userText("x");
  expect(parseLine(JSON.stringify(noCwd)).status).toBe("malformed");
  expect(
    parseLine(JSON.stringify({ ...userText("x"), timestamp: "nope" })).status,
  ).toBe("malformed");
});

test("user content가 text 블록 배열이어도 미리보기를 만든다", () => {
  const r = ok(
    JSON.stringify({
      ...userText("x"),
      message: { role: "user", content: [{ type: "text", text: "안녕" }] },
    }),
  );
  expect(r.events[0]).toMatchObject({
    kind: "user",
    preview: "안녕",
    contentLength: 2,
  });
});

test("contentLength는 이모지를 1자로 센다", () => {
  expect(ok(JSON.stringify(userText("😀"))).events[0].contentLength).toBe(1);
});

test("assistant 줄에 message.id가 없으면 malformed", () => {
  const line = assistantLine({ id: "m0" });
  // JSON.stringify는 undefined 필드를 빼므로 id 키가 없는 줄이 된다.
  const noId = { ...line, message: { ...line.message, id: undefined } };
  expect(parseLine(JSON.stringify(noId)).status).toBe("malformed");
});
