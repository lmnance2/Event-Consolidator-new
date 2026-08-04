import { hashToken } from "@/lib/auth/tokens";
import { hashPassword } from "@/lib/auth/password";
import { prisma as defaultPrisma } from "@/lib/db/client";
import type { PrismaClient } from "@prisma/client";

export interface ResetPasswordResult {
  ok: boolean;
  error?: string;
}

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string,
  db: Pick<PrismaClient, "passwordResetToken" | "user"> = defaultPrisma
): Promise<ResetPasswordResult> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!record || record.usedAt !== null || record.expiresAt < now) {
    return { ok: false, error: "Invalid or expired token" };
  }

  const { count } = await db.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: now },
  });

  if (count === 0) {
    return { ok: false, error: "Invalid or expired token" };
  }

  const passwordHash = await hashPassword(newPassword);

  await db.user.update({
    where: { id: record.userId },
    data: {
      passwordHash,
      sessionVersion: { increment: 1 },
    },
  });

  return { ok: true };
}
