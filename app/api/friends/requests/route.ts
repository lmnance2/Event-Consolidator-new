import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { orderedPair } from "@/lib/friends/pair";
import {
  createFriendRequestTupleRateLimiter,
  createFriendRequestSenderRateLimiter,
} from "@/lib/auth/rate-limit";

const BodySchema = z.object({
  email: z.string().email(),
});

// Silent-success shape returned on every code path to prevent enumeration.
const SILENT_OK = { ok: true };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const senderId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email } = parsed.data;

  // Rate limit: tuple (email:senderId) first, then sender-only fallback.
  const tupleKey = `${email}:${senderId}`;

  try {
    const tupleLimiter = createFriendRequestTupleRateLimiter();
    const tupleResult = await tupleLimiter.limit(tupleKey);
    if (!tupleResult.success) {
      return Response.json(SILENT_OK, { status: 429 });
    }

    const senderLimiter = createFriendRequestSenderRateLimiter();
    const senderResult = await senderLimiter.limit(senderId);
    if (!senderResult.success) {
      return Response.json(SILENT_OK, { status: 429 });
    }
  } catch (err) {
    console.error("[friends/requests POST] rate-limit error", err);
    // On Redis failure, allow the request through rather than hard-erroring.
  }

  try {
    // Look up the recipient by email. Unknown email → silent success.
    const recipient = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!recipient) {
      return Response.json(SILENT_OK);
    }

    const recipientId = recipient.id;

    // Self-request → silent success.
    if (senderId === recipientId) {
      return Response.json(SILENT_OK);
    }

    // Existing friendship → silent success.
    const [userAId, userBId] = orderedPair(senderId, recipientId);
    const existingFriendship = await prisma.friendship.findUnique({
      where: { userAId_userBId: { userAId, userBId } },
      select: { id: true },
    });
    if (existingFriendship) {
      return Response.json(SILENT_OK);
    }

    // Existing PENDING request in either direction → silent success (idempotent).
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        status: "PENDING",
        OR: [
          { fromUserId: senderId, toUserId: recipientId },
          { fromUserId: recipientId, toUserId: senderId },
        ],
      },
      select: { id: true },
    });
    if (existingRequest) {
      return Response.json(SILENT_OK);
    }

    // Create the request. P2002 on (fromUserId, toUserId) = idempotent.
    await prisma.friendRequest.create({
      data: { fromUserId: senderId, toUserId: recipientId },
    });

    return Response.json(SILENT_OK);
  } catch (err) {
    console.error("[friends/requests POST]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const [incoming, outgoing] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { toUserId: userId, status: "PENDING" },
        select: {
          id: true,
          createdAt: true,
          fromUser: { select: { id: true, name: true, image: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.friendRequest.findMany({
        where: { fromUserId: userId, status: "PENDING" },
        select: {
          id: true,
          createdAt: true,
          toUser: { select: { id: true, name: true, image: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return Response.json({
      incoming: incoming.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        user: r.fromUser,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        user: r.toUser,
      })),
    });
  } catch (err) {
    console.error("[friends/requests GET]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
