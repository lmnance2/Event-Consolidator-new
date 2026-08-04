import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { createSignupRateLimiter, createSignupIpRateLimiter } from "@/lib/auth/rate-limit";
import { geocodeZip } from "@/lib/geo/geocode";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code"),
});

const GENERIC_SUCCESS = { ok: true };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[signup] Invalid POST body:", parsed.error.issues);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { name, email, password, zipCode } = parsed.data;

  const emailIpLimiter = createSignupRateLimiter();
  const { success: emailIpOk } = await emailIpLimiter.limit(`${email}:${ip}`);
  if (!emailIpOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const ipLimiter = createSignupIpRateLimiter();
  const { success: ipOk } = await ipLimiter.limit(ip);
  if (!ipOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const coords = await geocodeZip(zipCode);

  if (!coords) {
    console.error("[signup] geocodeZip returned null for zip:", zipCode);
    return NextResponse.json(
      { error: "We couldn't find that ZIP code. Please double-check it." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    await hashPassword("throwaway-timing-mask");
    return NextResponse.json(GENERIC_SUCCESS);
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        zipCode,
        latitude: coords.lat,
        longitude: coords.lng,
      },
    });

    await tx.userPreferences.create({
      data: { userId: user.id },
    });

    await tx.subscription.create({
      data: { userId: user.id },
    });

    return user;
  });

  return NextResponse.json(GENERIC_SUCCESS);
}
