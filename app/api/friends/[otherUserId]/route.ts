import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { orderedPair } from "@/lib/friends/pair";

const ParamSchema = z.object({
  otherUserId: z.string().min(1),
});

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ otherUserId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paramParsed = ParamSchema.safeParse(await params);
  if (!paramParsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { otherUserId } = paramParsed.data;
  const userId = session.user.id;

  const [userAId, userBId] = orderedPair(userId, otherUserId);

  try {
    // deleteMany is idempotent: 0 rows deleted still returns 200.
    await prisma.friendship.deleteMany({
      where: { userAId, userBId },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[friends/[otherUserId] DELETE]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
