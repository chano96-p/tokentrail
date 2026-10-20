// 테스트용이라 느슨한 타입으로 둔다(필드를 지우거나 바꾸는 테스트가 있음).
export function assistantLine(o: {
  id: string;
  uuid?: string;
  blocks?: unknown[];
}) {
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

export function userText(text: string, uuid?: string) {
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

export function userToolResult(o?: {
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
