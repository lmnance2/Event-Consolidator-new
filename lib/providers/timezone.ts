function buildIsoOffset(sign: string, hours: string, mins?: string): string {
  const h = hours.padStart(2, "0");
  const m = (mins ?? "00").padStart(2, "0");
  return `${sign}${h}:${m}`;
}

// Converts a local-time ISO string ("2030-01-15T18:30:00") plus IANA tz
// ("America/Chicago") to a UTC Date. If the string already carries an offset
// or 'Z', that wins. Falls back to appending 'Z' with a logged warning.
export function parseLocalDateTime(
  dateTimeStr: string,
  timezone: string,
  logTag: string
): Date {
  const isoLike = dateTimeStr.includes("T")
    ? dateTimeStr
    : dateTimeStr.replace(" ", "T");

  if (isoLike.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(isoLike)) {
    return new Date(isoLike);
  }

  try {
    const offsetFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "shortOffset",
    });
    const offsetParts = offsetFormatter.formatToParts(new Date(isoLike));
    const offsetStr = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const offsetMatch = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (offsetMatch) {
      const isoOffset = buildIsoOffset(offsetMatch[1], offsetMatch[2], offsetMatch[3]);
      return new Date(`${isoLike}${isoOffset}`);
    }
    if (offsetStr === "GMT") {
      return new Date(`${isoLike}+00:00`);
    }
  } catch {
  }

  console.warn(
    JSON.stringify({
      event: `${logTag}.tz_parse_fallback`,
      timezone,
      dateTimeStr,
      reason: "offset_extraction_failed",
    })
  );
  return new Date(isoLike + "Z");
}
