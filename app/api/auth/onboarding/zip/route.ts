import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { auth } from "@/lib/auth";
import { geocodeZip } from "@/lib/geo/geocode";

const zipSchema = z.object({
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
});

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = zipSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[onboarding/zip] Invalid POST body:", parsed.error.issues);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { zipCode } = parsed.data;
  const coords = await geocodeZip(zipCode);

  if (!coords) {
    console.error(JSON.stringify({ event: "onboarding.geocode_null" }));
    return NextResponse.json(
      { error: "We couldn't find that ZIP code. Please double-check it." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      zipCode,
      latitude: coords.lat,
      longitude: coords.lng,
    },
  });

  return NextResponse.json({ ok: true });
}
