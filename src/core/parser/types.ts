export type EventKind =
  | "user"
  | "assistant_text"
  | "thinking"
  | "tool_use"
  | "tool_result"
  | "system";

export type LineContext = {
  sessionId: string;
  agentId: string | null;
  cwd: string;
  gitBranch: string | null;
  cliVersion: string | null;
  timestamp: Date;
};

export type ApiCallRecord = {
  messageId: string;
  sessionId: string;
  agentId: string | null;
  model: string;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  stopReason: string | null;
  skill: string | null;
  plugin: string | null;
};

export type TimelineEventRecord = {
  uuid: string;
  sessionId: string;
  agentId: string | null;
  parentUuid: string | null;
  apiCallId: string | null;
  timestamp: Date;
  kind: EventKind;
  toolName: string | null;
  inputSummary: string | null;
  isError: boolean;
  contentLength: number;
  preview: string | null;
};

export type ParsedLine =
  | {
      status: "ok";
      sessionId: string;
      context: LineContext | null;
      title: string | null;
      apiCall: ApiCallRecord | null;
      events: TimelineEventRecord[];
    }
  | { status: "ignored" }
  | { status: "malformed" };
