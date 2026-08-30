import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { isPro } from "@/lib/subscription/is-pro";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const [savedEvents, goingEvents, subscription, pendingCount, friendCount] = await Promise.all([
      prisma.savedEvent.findMany({
        where: { userId },
        select: { eventId: true },
      }),
      prisma.goingEvent.findMany({
        where: { userId },
        select: { eventId: true },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: { status: true },
      }),
      prisma.friendRequest.count({
        where: { toUserId: userId, status: "PENDING" },
      }),
      prisma.friendship.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      }),
    ]);

    return new Response(
      JSON.stringify({
        saved: savedEvents.map((e) => e.eventId),
        going: goingEvents.map((e) => e.eventId),
        isPro: isPro(subscription),
        pendingFriendRequests: pendingCount,
        friendCount,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (err) {
    console.error("[event-state GET]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
