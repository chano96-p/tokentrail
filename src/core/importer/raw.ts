import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

// 이벤트 uuid의 '#n'은 한 줄을 여러 이벤트로 나눌 때 붙인 접미사라 원본 줄에는 없다.
export async function readRawLine(
  filePath: string,
  uuid: string,
): Promise<unknown | null> {
  const lineUuid = uuid.split("#")[0];

  const stream = createReadStream(filePath);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      // 대부분의 줄을 JSON.parse 없이 거른다. parentUuid 등에도 같은 문자열이 있어 아래에서 다시 확인한다.
      if (!line.includes(lineUuid)) continue;

      let entry: unknown;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (
        typeof entry === "object" &&
        entry !== null &&
        (entry as { uuid?: unknown }).uuid === lineUuid
      )
        return entry;
    }
    return null;
  } catch (error) {
    // import 뒤에 로그 파일이 지워지거나 옮겨진 경우. 원본 줄이 없는 것과 같게 본다.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  } finally {
    // 찾자마자 반복을 빠져나와도 파일 핸들이 남지 않게 닫는다.
    stream.destroy();
  }
}
