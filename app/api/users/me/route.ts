import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { geocodeZip } from "@/lib/geo/geocode";
import { z } from "zod";

const patchMeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  zipCode: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code")
    .optional(),
});

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

  const parsed = patchMeSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[me] Invalid PATCH body:", parsed.error.issues);
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { name, zipCode } = parsed.data;

  if (!name && !zipCode) {
    return Response.json(
      { error: "At least one field must be provided" },
      { status: 400 }
    );
  }

  const updateData: {
    name?: string;
    zipCode?: string;
    latitude?: number | null;
    longitude?: number | null;
  } = {};

  if (name !== undefined) {
    updateData.name = name;
  }

  if (zipCode !== undefined) {
    updateData.zipCode = zipCode;
    const coords = await geocodeZip(zipCode);
    updateData.latitude = coords?.lat ?? null;
    updateData.longitude = coords?.lng ?? null;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        zipCode: true,
      },
    });

    return Response.json(updated);
  } catch (err) {
    console.error("[me PATCH]", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.user.delete({
      where: { id: session.user.id },
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("[me DELETE]", err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
