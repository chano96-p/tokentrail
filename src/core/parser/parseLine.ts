import { summarizeToolInput, truncate } from "./summarize";
import type {
  ApiCallRecord,
  EventKind,
  LineContext,
  ParsedLine,
  TimelineEventRecord,
} from "./types";

const MAX_PREVIEW_LENGTH = 500;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

// truncate와 같은 단위(코드 포인트)로 센다.
function charCount(text: string): number {
  return Array.from(text).length;
}

// tool_result의 content는 문자열이거나 [{ type: "text", text }] 블록 배열이다.
function toolResultLength(content: unknown): number {
  if (typeof content === "string") return charCount(content);
  if (!Array.isArray(content)) return 0;
  return content.reduce<number>(
    (sum, block) => sum + charCount(asString(asRecord(block).text) ?? ""),
    0,
  );
}

export function parseLine(line: string): ParsedLine {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return { status: "malformed" };
  }
  if (typeof raw !== "object" || raw === null) {
    return { status: "malformed" };
  }

  const entry = raw as Record<string, unknown>;
  const lineType = entry.type;

  if (
    lineType !== "ai-title" &&
    lineType !== "custom-title" &&
    lineType !== "user" &&
    lineType !== "assistant" &&
    lineType !== "system"
  ) {
    return { status: "ignored" };
  }
  if (lineType === "user" && entry.isMeta === true) {
    return { status: "ignored" };
  }

  // 아래 필수 값이 없으면 지어낸 값으로 채우지 않고 malformed로 센다.
  const sessionId = asString(entry.sessionId);
  if (!sessionId) return { status: "malformed" };

  if (lineType === "ai-title" || lineType === "custom-title") {
    return {
      status: "ok",
      sessionId,
      context: null,
      title: asString(
        lineType === "custom-title" ? entry.customTitle : entry.aiTitle,
      ),
      titleSource: lineType === "custom-title" ? "custom" : "ai",
      apiCall: null,
      events: [],
    };
  }

  const uuid = asString(entry.uuid);
  const cwd = asString(entry.cwd);
  const timestampText = asString(entry.timestamp);
  if (!uuid || !cwd || !timestampText) return { status: "malformed" };
  const timestamp = new Date(timestampText);
  if (Number.isNaN(timestamp.getTime())) return { status: "malformed" };

  const context: LineContext = {
    sessionId,
    agentId: asString(entry.agentId),
    cwd,
    gitBranch: asString(entry.gitBranch),
    cliVersion: asString(entry.version),
    timestamp,
  };
  const message = asRecord(entry.message);
  const parentUuid = asString(entry.parentUuid);

  const events: TimelineEventRecord[] = [];
  const pushEvent = (
    kind: EventKind,
    overrides: Partial<TimelineEventRecord> = {},
  ) => {
    const index = events.length;
    events.push({
      uuid: index === 0 ? uuid : `${uuid}#${index}`,
      sessionId,
      agentId: context.agentId,
      parentUuid,
      apiCallId: null,
      timestamp: context.timestamp,
      kind,
      toolName: null,
      inputSummary: null,
      isError: false,
      contentLength: 0,
      preview: null,
      ...overrides,
    });
  };

  let apiCall: ApiCallRecord | null = null;

  if (lineType === "user") {
    const content = message.content;
    if (typeof content === "string") {
      pushEvent("user", {
        contentLength: charCount(content),
        preview: truncate(content, MAX_PREVIEW_LENGTH),
      });
    } else if (Array.isArray(content)) {
      for (const item of content) {
        const block = asRecord(item);
        if (block.type === "text") {
          const text = asString(block.text) ?? "";
          pushEvent("user", {
            contentLength: charCount(text),
            preview: truncate(text, MAX_PREVIEW_LENGTH),
          });
        } else if (block.type === "tool_result") {
          pushEvent("tool_result", {
            isError: block.is_error === true,
            contentLength: toolResultLength(block.content),
          });
        }
      }
    }
  }

  if (lineType === "assistant") {
    const messageId = asString(message.id);
    if (!messageId) return { status: "malformed" };

    const usage = asRecord(message.usage);
    // 합계를 기준으로 삼는다. 값이 비워진 중복 줄은 합계가 0인데 1h만 남아 있어서 TTL 값을 그대로 믿으면 없는 토큰이 생긴다.
    const cacheWriteTotal = asNumber(usage.cache_creation_input_tokens);
    const cacheWrite1hTokens = Math.min(
      asNumber(asRecord(usage.cache_creation).ephemeral_1h_input_tokens),
      cacheWriteTotal,
    );

    apiCall = {
      messageId,
      sessionId,
      agentId: context.agentId,
      model: asString(message.model) ?? "unknown",
      timestamp: context.timestamp,
      inputTokens: asNumber(usage.input_tokens),
      outputTokens: asNumber(usage.output_tokens),
      cacheReadTokens: asNumber(usage.cache_read_input_tokens),
      cacheWrite5mTokens: cacheWriteTotal - cacheWrite1hTokens,
      cacheWrite1hTokens,
      stopReason: asString(message.stop_reason),
      skill: asString(entry.attributionSkill),
      plugin: asString(entry.attributionPlugin),
    };

    const blocks = Array.isArray(message.content) ? message.content : [];
    for (const item of blocks) {
      const block = asRecord(item);
      if (block.type === "text") {
        const text = asString(block.text) ?? "";
        pushEvent("assistant_text", {
          apiCallId: messageId,
          contentLength: charCount(text),
          preview: truncate(text, MAX_PREVIEW_LENGTH),
        });
      } else if (block.type === "thinking") {
        pushEvent("thinking", {
          apiCallId: messageId,
          contentLength: charCount(asString(block.thinking) ?? ""),
        });
      } else if (block.type === "tool_use") {
        const toolName = asString(block.name);
        pushEvent("tool_use", {
          apiCallId: messageId,
          toolName,
          inputSummary: toolName
            ? summarizeToolInput(toolName, block.input)
            : null,
        });
      }
    }
  }

  if (lineType === "system") {
    pushEvent("system", {
      isError: entry.level === "error",
      preview: asString(entry.subtype),
    });
  }

  return {
    status: "ok",
    sessionId,
    context,
    title: null,
    titleSource: null,
    apiCall,
    events,
  };
}
