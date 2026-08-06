const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

type EventInput = {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime?: Date | null;
  venue?: string | null;
  sources?: Array<{ ticketUrl: string }>;
};

function toIcsDatetime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    String(date.getUTCFullYear()) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) {
    return line;
  }
  const parts: string[] = [];
  let offset = 0;
  let first = true;
  while (offset < bytes.length) {
    const chunkSize = first ? 75 : 74;
    const chunk = bytes.slice(offset, offset + chunkSize);
    parts.push(chunk.toString("utf8"));
    offset += chunkSize;
    first = false;
  }
  return parts.join("\r\n ");
}

export function buildIcsFile(event: EventInput): string {
  const now = new Date();
  const endTime = event.endTime ?? new Date(event.startTime.getTime() + TWO_HOURS_MS);
  const ticketUrl = event.sources?.[0]?.ticketUrl ?? "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Event Atlas//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@eventatlas.app`,
    `DTSTAMP:${toIcsDatetime(now)}`,
    `DTSTART:${toIcsDatetime(event.startTime)}`,
    `DTEND:${toIcsDatetime(endTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description ?? "")}`,
    `LOCATION:${escapeIcsText(event.venue ?? "")}`,
    `URL:${ticketUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(foldLine).join("\r\n") + "\r\n";
}
