import { open } from "node:fs/promises";

const NEWLINE = 0x0a;

export async function readCompleteLines(
  path: string,
  fromOffset: number,
): Promise<{ lines: string[]; nextOffset: number }> {
  const handle = await open(path, "r");
  try {
    const { size } = await handle.stat();

    if (fromOffset > size)
      throw new Error(
        `offset(${fromOffset})이 파일 크기(${size})보다 큽니다: ${path}`,
      );

    const { buffer, bytesRead } = await handle.read({
      buffer: Buffer.alloc(size - fromOffset),
      position: fromOffset,
    });

    const lastNewline = buffer.subarray(0, bytesRead).lastIndexOf(NEWLINE);
    if (lastNewline === -1) {
      return { lines: [], nextOffset: fromOffset };
    }

    const completeBytes = buffer.subarray(0, lastNewline + 1);
    const lines = completeBytes.toString("utf8").split("\n").filter(Boolean);

    return { lines, nextOffset: fromOffset + completeBytes.length };
  } finally {
    await handle.close();
  }
}
