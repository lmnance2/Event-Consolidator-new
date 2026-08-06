type EventInput = {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime?: Date | null;
  venue?: string | null;
};

function toGoogleDatetime(date: Date): string {
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

export function googleCalendarUrl(event: EventInput): string {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const endTime = event.endTime ?? new Date(event.startTime.getTime() + TWO_HOURS_MS);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toGoogleDatetime(event.startTime)}/${toGoogleDatetime(endTime)}`,
    details: event.description ?? "",
    location: event.venue ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// This function is client-only: it reads window.location.host at call time
// so the webcal URL is correct regardless of how the app is deployed.
// It is only ever invoked from a click handler in a Client Component.
export function appleCalendarUrl(event: EventInput): string {
  if (typeof window === "undefined") {
    // Should never be reached — this is always called from a click handler.
    // Guard is here only to satisfy the type-checker for any future SSR slip.
    throw new Error("appleCalendarUrl must be called client-side");
  }
  const host = window.location.host;
  return `webcal://${host}/api/events/${event.id}/ics`;
}
