import { z } from "zod";
import { auth } from "@/lib/auth";
import { listFriendsGoing } from "@/lib/friends/queries";

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
  const userId = session.user.id;

  try {
    const friends = await listFriendsGoing(eventId, userId);
    return Response.json(friends);
  } catch (err) {
    console.error("[events/[id]/friends-going GET]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
