import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { preferencesPartialSchema, PRO_ONLY_FIELDS } from "@/lib/preferences/schema";
import { isPro } from "@/lib/subscription/is-pro";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: session.user.id },
    });

    if (!preferences) {
      return Response.json({ error: "Preferences not found" }, { status: 404 });
    }

    return Response.json(preferences);
  } catch (err) {
    console.error("[preferences GET]", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = preferencesPartialSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[preferences] Invalid PATCH body:", parsed.error.issues);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const input = parsed.data;

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });

  if (!isPro(subscription)) {
    for (const field of PRO_ONLY_FIELDS) {
      delete (input as Record<string, unknown>)[field];
    }
  }

  try {
    const updated = await prisma.userPreferences.update({
      where: { userId: session.user.id },
      data: input,
    });

    return Response.json(updated);
  } catch (err) {
    console.error("[preferences PATCH]", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
