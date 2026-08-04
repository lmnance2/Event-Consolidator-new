import { SubscriptionStatus } from "@prisma/client";

export function isPro(
  subscription: { status: SubscriptionStatus } | null
): boolean {
  return subscription?.status === SubscriptionStatus.ACTIVE;
}
