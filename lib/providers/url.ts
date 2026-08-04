export function assertHttpsUrl(
  url: string | undefined | null,
  fallback: string
): string {
  if (typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) return fallback;
  return trimmed;
}
