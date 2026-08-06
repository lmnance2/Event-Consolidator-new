import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { computeReminderSendAt } from "@/lib/events/reminder";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ReminderStatus } from "@prisma/client";

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

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startTime: true, isActive: true },
  });

  if (!event || !event.isActive) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const sendAt = computeReminderSendAt(event.startTime, now);

  try {
    // Wrap goingEvent.create + reminder upsert in one transaction so that a
    // crash between them can never leave the user Going without a reminder.
    await prisma.$transaction(async (tx) => {
      await tx.goingEvent.create({ data: { userId, eventId } });

      if (sendAt !== null) {
        const updated = await tx.eventReminder.updateMany({
          where: { userId, eventId, status: ReminderStatus.PENDING },
          data: { sendAt },
        });
        if (updated.count === 0) {
          await tx.eventReminder.create({
            data: { userId, eventId, sendAt, status: ReminderStatus.PENDING },
          });
        }
      }
    });

    return Response.json({ going: true });
  } catch (err) {
    if (
      err instanceof PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return Response.json({ going: true });
    }
    console.error("[going POST]", err);
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
    await prisma.$transaction([
      prisma.goingEvent.deleteMany({ where: { userId, eventId } }),
      prisma.eventReminder.updateMany({
        where: { userId, eventId, status: ReminderStatus.PENDING },
        data: { status: ReminderStatus.CANCELLED },
      }),
    ]);

    return Response.json({ going: false });
  } catch (err) {
    console.error("[going DELETE]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
