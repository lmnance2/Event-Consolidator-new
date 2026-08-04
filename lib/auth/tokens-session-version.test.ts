import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $transaction: vi.fn(),
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe("newPasswordResetToken — deletes prior unused tokens in transaction", () => {
  it("calls deleteMany for unused tokens before creating a new one", async () => {
    vi.resetModules();

    const mockTx = {
      passwordResetToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: "new-token" }),
      },
    };

    const { prisma } = await import("@/lib/db/client");
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: Parameters<typeof prisma.$transaction>[0]) => {
      return (fn as (tx: unknown) => Promise<unknown>)(mockTx);
    });

    vi.resetModules();
    const { newPasswordResetToken } = await import("./tokens");

    await newPasswordResetToken("user-123");

    expect(mockTx.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-123", usedAt: null },
    });

    expect(mockTx.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-123" }),
      })
    );

    const deleteOrder = mockTx.passwordResetToken.deleteMany.mock.invocationCallOrder[0];
    const createOrder = mockTx.passwordResetToken.create.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it("returns a 64-character hex raw token", async () => {
    const mockTx = {
      passwordResetToken: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "new-token" }),
      },
    };

    vi.resetModules();
    const { prisma } = await import("@/lib/db/client");
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: Parameters<typeof prisma.$transaction>[0]) => {
      return (fn as (tx: unknown) => Promise<unknown>)(mockTx);
    });

    vi.resetModules();
    const { newPasswordResetToken } = await import("./tokens");

    const raw = await newPasswordResetToken("user-456");

    expect(typeof raw).toBe("string");
    expect(raw).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(raw)).toBe(true);
  });
});
