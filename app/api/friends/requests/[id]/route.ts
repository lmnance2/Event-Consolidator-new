import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { orderedPair } from "@/lib/friends/pair";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const ParamSchema = z.object({
  id: z.string().min(1),
});

const PatchBodySchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paramParsed = ParamSchema.safeParse(await params);
  if (!paramParsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const bodyParsed = PatchBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id: requestId } = paramParsed.data;
  const { action } = bodyParsed.data;
  const userId = session.user.id;

  try {
    // IDOR: fetch and verify ownership before acting.
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      select: { fromUserId: true, toUserId: true, status: true },
    });

    // Return generic 404 regardless of whether the row exists or the user
    // doesn't own it — prevents enumeration of request IDs.
    if (!request || request.toUserId !== userId) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (request.status !== "PENDING") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "decline") {
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED" },
      });
      return Response.json({ ok: true });
    }

    // action === "accept": serializable transaction to mark accepted + upsert Friendship.
    const [userAId, userBId] = orderedPair(request.fromUserId, request.toUserId);

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.friendRequest.update({
            where: { id: requestId },
            data: { status: "ACCEPTED" },
          });

          await tx.friendship.upsert({
            where: { userAId_userBId: { userAId, userBId } },
            create: { userAId, userBId },
            update: {},
          });
        },
        { isolationLevel: "Serializable" }
      );
    } catch (txErr) {
      // P2002 on the unique pair = already-friends (accept race); treat as success.
      if (
        txErr instanceof PrismaClientKnownRequestError &&
        txErr.code === "P2002"
      ) {
        return Response.json({ ok: true });
      }
      throw txErr;
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[friends/requests/[id] PATCH]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paramParsed = ParamSchema.safeParse(await params);
  if (!paramParsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id: requestId } = paramParsed.data;
  const userId = session.user.id;

  try {
    // IDOR: verify the caller is the sender, and status must still be PENDING.
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      select: { fromUserId: true, status: true },
    });

    if (!request || request.fromUserId !== userId || request.status !== "PENDING") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.friendRequest.delete({ where: { id: requestId } });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[friends/requests/[id] DELETE]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
