import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { passwordSchema } from "@/lib/auth/password";
import { consumePasswordResetToken } from "@/lib/auth/reset-password";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: passwordSchema,
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[reset-password] Invalid POST body:", parsed.error.issues);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { token: rawToken, newPassword } = parsed.data;
  const result = await consumePasswordResetToken(rawToken, newPassword);

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Invalid or expired token" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
