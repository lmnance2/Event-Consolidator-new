import crypto from "node:crypto";
import { prisma } from "@/lib/db/client";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function newPasswordResetToken(userId: string): Promise<string> {
  const raw = generateToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({
      where: { userId, usedAt: null },
    });

    await tx.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  });

  return raw;
}
