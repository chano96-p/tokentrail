const SUMMARY_FIELD_BY_TOOL: Record<string, string> = {
  Bash: "command",
  Read: "file_path",
  Write: "file_path",
  Edit: "file_path",
  Grep: "pattern",
  Glob: "pattern",
  Agent: "description",
  Task: "description",
};

const MAX_SUMMARY_LENGTH = 200;

export function truncate(text: string, max: number): string {
  const codePoints = Array.from(text);

  if (codePoints.length <= max) {
    return text;
  }

  return codePoints.slice(0, max).join("") + "…";
}

export function summarizeToolInput(
  name: string,
  input: unknown,
): string | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const inputFields = input as Record<string, unknown>;

  const field = SUMMARY_FIELD_BY_TOOL[name];
  const candidate = field
    ? inputFields[field]
    : Object.values(inputFields).find((v) => typeof v === "string");

  return typeof candidate === "string"
    ? truncate(candidate, MAX_SUMMARY_LENGTH)
    : null;
}
