const SEPARATOR = "|";

export interface CursorPayload {
  startTime: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(
    JSON.stringify({ startTime: payload.startTime, id: payload.id })
  ).toString("base64url");
}

export function decodeCursor(raw: string): CursorPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).startTime !== "string" ||
      typeof (parsed as Record<string, unknown>).id !== "string"
    ) {
      return null;
    }
    const { startTime, id } = parsed as { startTime: string; id: string };
    const ts = new Date(startTime);
    if (isNaN(ts.getTime())) return null;
    return { startTime, id };
  } catch {
    return null;
  }
}

export { SEPARATOR };
