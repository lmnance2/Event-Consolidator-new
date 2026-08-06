const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function computeReminderSendAt(
  startTime: Date,
  now: Date
): Date | null {
  const sendAt = new Date(startTime.getTime() - TWENTY_FOUR_HOURS_MS);
  if (sendAt.getTime() > now.getTime()) {
    return sendAt;
  }
  return null;
}
