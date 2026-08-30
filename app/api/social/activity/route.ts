import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { isPro } from "@/lib/subscription/is-pro";
import { getFriendActivityPage, decodeActivityCursor } from "@/lib/friends/activity";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  });
  if (!isPro(subscription)) {
    return Response.json(
      { error: "Pro subscription required", code: "PRO_REQUIRED" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const cursorParam = url.searchParams.get("cursor");
  let cursor = null;
  if (cursorParam) {
    cursor = decodeActivityCursor(cursorParam);
    if (!cursor) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }
  }

  try {
    const page = await getFriendActivityPage({ userId, cursor });
    return Response.json(page);
  } catch (err) {
    console.error("[social/activity GET]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
