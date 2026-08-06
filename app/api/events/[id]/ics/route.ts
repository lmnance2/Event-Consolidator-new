import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { buildIcsFile } from "@/lib/calendar/ics";

const ParamSchema = z.object({
  id: z.string().min(1),
});

export async function GET(
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

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        description: true,
        startTime: true,
        endTime: true,
        venue: true,
        sources: {
          select: { ticketUrl: true },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!event) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const icsContent = buildIcsFile(event);

    return new Response(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="event-${eventId}.ics"`,
      },
    });
  } catch (err) {
    console.error("[ics GET]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
