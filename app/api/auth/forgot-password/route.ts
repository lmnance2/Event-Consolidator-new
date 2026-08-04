import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { newPasswordResetToken } from "@/lib/auth/tokens";
import { createForgotPasswordRateLimiter } from "@/lib/auth/rate-limit";
import { sendEmail } from "@/lib/email/send";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";
import * as React from "react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const GENERIC_SUCCESS = { ok: true };
const JITTER_FLOOR_MS = 200;

function jitterDelay(): Promise<void> {
  const delay = JITTER_FLOOR_MS + Math.random() * 300;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await jitterDelay();
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[forgot-password] Invalid POST body:", parsed.error.issues);
    await jitterDelay();
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email } = parsed.data;

  const limiter = createForgotPasswordRateLimiter();
  const { success } = await limiter.limit(`${email}:${ip}`);
  if (!success) {
    await jitterDelay();
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (user) {
    newPasswordResetToken(user.id)
      .then((rawToken) => {
        const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
        return sendEmail({
          to: email,
          subject: "Reset your Event Atlas password",
          react: React.createElement(PasswordResetEmail, { resetUrl }),
        });
      })
      .catch((err: unknown) => {
        console.error(
          "[forgot-password] Failed to issue or send reset email:",
          err instanceof Error ? err.message : "unknown error"
        );
      });
  }

  await jitterDelay();
  return NextResponse.json(GENERIC_SUCCESS);
}
