import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: {
        id: true,
        createdAt: true,
        userA: { select: { id: true, name: true, image: true } },
        userB: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = friendships.map((f) => {
      const other = f.userA.id === userId ? f.userB : f.userA;
      return {
        id: other.id,
        name: other.name,
        image: other.image,
        friendsSince: f.createdAt.toISOString(),
      };
    });

    return Response.json(result);
  } catch (err) {
    console.error("[friends GET]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
