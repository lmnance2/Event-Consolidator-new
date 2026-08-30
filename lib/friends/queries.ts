import { prisma } from "@/lib/db/client";
import { orderedPair } from "./pair";

/**
 * Returns the IDs of all accepted friends for a given user.
 * Handles the userAId < userBId invariant by checking both positions.
 */
export async function listFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { userAId: true, userBId: true },
  });

  return friendships.map((f) => (f.userAId === userId ? f.userBId : f.userAId));
}

/**
 * Returns true if a mutual friendship exists between the two users.
 * Derives the ordered pair so the lookup always uses the correct composite key.
 */
export async function areFriends(a: string, b: string): Promise<boolean> {
  const [userAId, userBId] = orderedPair(a, b);
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: { id: true },
  });
  return friendship !== null;
}

/**
 * Returns the count of incoming PENDING friend requests for the given user.
 * Used for the badge on UserMenu.
 */
export async function pendingRequestCount(userId: string): Promise<number> {
  return prisma.friendRequest.count({
    where: { toUserId: userId, status: "PENDING" },
  });
}

/**
 * Returns the friends of userId who are going to the given event.
 * Performs an inner-join of Friendship x GoingEvent — only the user's accepted
 * friends are included; strangers and the user themselves are excluded.
 */
export async function listFriendsGoing(
  eventId: string,
  userId: string
): Promise<Array<{ id: string; name: string | null; image: string | null }>> {
  const friendIds = await listFriendIds(userId);
  if (friendIds.length === 0) return [];

  const goingFriends = await prisma.goingEvent.findMany({
    where: {
      eventId,
      userId: { in: friendIds },
    },
    select: {
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return goingFriends.map((g) => g.user);
}
