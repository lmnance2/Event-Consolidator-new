import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { isPro } from "@/lib/subscription/is-pro";
import { FREE_SAVE_LIMIT } from "@/lib/subscription/constants";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const ParamSchema = z.object({
  id: z.string().min(1),
});

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = ParamSchema.safeParse(await params);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id: eventId } = parsed.data;
  const userId = session.user.id;

  // Verify the event exists and is active before entering the transaction.
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, isActive: true },
  });
  if (!event || !event.isActive) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  });
  const userIsPro = isPro(subscription);

  try {
    await prisma.$transaction(
      async (tx) => {
        if (!userIsPro) {
          // Serializable isolation + count-then-create in one tx closes the
          // TOCTOU race across two concurrent POSTs on different eventIds:
          // Postgres will abort one with P2034 rather than let both commit.
          const savedCount = await tx.savedEvent.count({ where: { userId } });
          if (savedCount >= FREE_SAVE_LIMIT) {
            throw Object.assign(new Error("SAVE_LIMIT_REACHED"), {
              code: "SAVE_LIMIT_REACHED",
            });
          }
        }
        await tx.savedEvent.create({ data: { userId, eventId } });
      },
      { isolationLevel: "Serializable" }
    );

    return Response.json({ saved: true });
  } catch (err) {
    if (
      err instanceof PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json({ saved: true });
    }
    if (err instanceof Error && (err as { code?: string }).code === "SAVE_LIMIT_REACHED") {
      return Response.json({ error: "SAVE_LIMIT_REACHED" }, { status: 409 });
    }
    if (
      err instanceof PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      // Serialization conflict: another concurrent save races us at the cap.
      // Return the same 409 shape as an explicit limit hit — from the user's
      // perspective the free-tier cap is what they collided with.
      return Response.json({ error: "SAVE_LIMIT_REACHED" }, { status: 409 });
    }
    console.error("[save POST]", err);
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

  const parsed = ParamSchema.safeParse(await params);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id: eventId } = parsed.data;
  const userId = session.user.id;

  try {
    await prisma.savedEvent.deleteMany({ where: { userId, eventId } });
    return Response.json({ saved: false });
  } catch (err) {
    console.error("[save DELETE]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
