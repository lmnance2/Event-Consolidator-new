/**
 * Returns an ordered pair [min, max] (lexicographic) from two user IDs.
 * This is the single enforcement point for the Friendship.userAId < userBId
 * invariant documented in prisma/schema.prisma. Every insert and lookup of
 * Friendship must go through this function.
 */
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
