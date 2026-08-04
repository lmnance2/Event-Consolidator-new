import { describe, it, expect, vi } from "vitest";
import { consumePasswordResetToken } from "./reset-password";

vi.mock("@/lib/auth/tokens", () => ({
  hashToken: (raw: string) => `hashed:${raw}`,
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: async (plain: string) => `bcrypt:${plain}`,
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {},
}));

describe("consumePasswordResetToken race condition guard", () => {
  it("rejects a second concurrent consumer of the same token (updateMany count === 0)", async () => {
    const validRecord = {
      id: "token-id-1",
      userId: "user-id-1",
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
    };

    let updateCallCount = 0;

    const mockDb = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue(validRecord),
        updateMany: vi.fn().mockImplementation(async () => {
          updateCallCount++;
          return { count: updateCallCount === 1 ? 1 : 0 };
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({}),
      },
      user: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    const [result1, result2] = await Promise.all([
      consumePasswordResetToken("raw-token", "NewPass1", mockDb as never),
      consumePasswordResetToken("raw-token", "NewPass2", mockDb as never),
    ]);

    const successes = [result1, result2].filter((r) => r.ok);
    const failures = [result1, result2].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.error).toBe("Invalid or expired token");

    expect(mockDb.user.update).toHaveBeenCalledTimes(1);
  });

  it("rejects an already-used token (usedAt is not null)", async () => {
    const usedRecord = {
      id: "token-id-2",
      userId: "user-id-2",
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: new Date(),
    };

    const mockDb = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue(usedRecord),
        updateMany: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    };

    const result = await consumePasswordResetToken("raw-token", "NewPass1", mockDb as never);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid or expired token");
    expect(mockDb.passwordResetToken.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const expiredRecord = {
      id: "token-id-3",
      userId: "user-id-3",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    };

    const mockDb = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue(expiredRecord),
        updateMany: vi.fn(),
      },
      user: {
        update: vi.fn(),
      },
    };

    const result = await consumePasswordResetToken("raw-token", "NewPass1", mockDb as never);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid or expired token");
    expect(mockDb.passwordResetToken.updateMany).not.toHaveBeenCalled();
  });

  it("returns ok:true and updates user on valid token", async () => {
    const validRecord = {
      id: "token-id-4",
      userId: "user-id-4",
      expiresAt: new Date(Date.now() + 3600_000),
      usedAt: null,
    };

    const mockDb = {
      passwordResetToken: {
        findUnique: vi.fn().mockResolvedValue(validRecord),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        update: vi.fn().mockResolvedValue(undefined),
      },
    };

    const result = await consumePasswordResetToken("raw-token", "NewPass1", mockDb as never);

    expect(result.ok).toBe(true);
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user-id-4" },
      data: expect.objectContaining({ sessionVersion: { increment: 1 } }),
    });
  });
});
