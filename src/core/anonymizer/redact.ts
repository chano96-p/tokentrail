export type RedactOptions = {
  homeDir: string;
  username: string;
  projectRoot: string | null;
  words?: string[]; // 회사·고객 이름처럼 대화 본문에서도 가릴 단어
};

const TRUNCATED_SECRET_PREFIX = /^(sk-|gh[pousr]_|AKIA)/;

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/g,
];

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 경로 뒤에 이름 글자가 이어지면(/app2, /meow) 접두사만 같은 다른 경로라 치환하지 않는다.
function pathPattern(path: string): RegExp {
  return new RegExp(`${escapeRegExp(path)}(?![\\w-]|\\.\\w)`, "g");
}

// 경로는 긴 것부터 지운다. 홈을 먼저 ~로 바꾸면 프로젝트 경로가 ~/...로 남아 상대 경로가 되지 않는다.
export function redactText(text: string, o: RedactOptions): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  result = result.replace(EMAIL_PATTERN, "[REDACTED]");
  if (o.projectRoot) {
    result = result
      .replaceAll(o.projectRoot + "/", "")
      .replace(pathPattern(o.projectRoot), ".");
  }
  result = result.replace(pathPattern(o.homeDir), "~");
  result = result.replace(
    new RegExp(`\\b${escapeRegExp(o.username)}\\b`, "g"),
    "user",
  );
  // _·-·.로 이어진 이름(acmecorp_official)은 가리고, 다른 단어 안에 들어간 경우(skills의 ski)는 둔다.
  for (const word of o.words ?? []) {
    result = result.replace(
      new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(word)}(?![A-Za-z0-9])`, "gi"),
      "[REDACTED]",
    );
  }
  return redactTruncatedTail(result, o);
}

// 미리보기는 sync 때 "…"로 잘려 저장돼, 끝에 남은 홈 경로·키 조각은 위 패턴에 걸리지 않는다.
function redactTruncatedTail(text: string, o: RedactOptions): string {
  if (!text.endsWith("…")) return text;
  const tail =
    text
      .slice(0, -1)
      .split(/[\s"'`(=]/)
      .pop() ?? "";
  const isPathPrefix =
    tail.length > 1 &&
    (o.homeDir.startsWith(tail) || !!o.projectRoot?.startsWith(tail));
  if (!isPathPrefix && !TRUNCATED_SECRET_PREFIX.test(tail)) return text;
  return text.slice(0, -1 - tail.length) + "[REDACTED]…";
}
