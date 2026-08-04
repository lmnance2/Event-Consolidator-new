const DAY_TIME_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

const FULL_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDayTime(isoString: string): string {
  const date = new Date(isoString);
  const parts = DAY_TIME_FMT.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const weekday = get("weekday");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod");
  return `${weekday}, ${month} ${day} · ${hour}:${minute} ${dayPeriod}`;
}

export function formatFullDate(isoString: string): string {
  return FULL_DATE_FMT.format(new Date(isoString));
}

export function formatTime(isoString: string): string {
  return TIME_FMT.format(new Date(isoString));
}

export function priceLabel(isFree: boolean, priceMin: number | null): string {
  if (isFree) return "Free";
  if (priceMin !== null) return `$${priceMin}`;
  return "Price not listed";
}

export function distanceLabel(distanceMi: number): string {
  if (distanceMi >= 10) {
    return `${Math.round(distanceMi)} mi`;
  }
  return `${Math.round(distanceMi * 10) / 10} mi`;
}
