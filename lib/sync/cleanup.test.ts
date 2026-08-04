import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function buildPrismaMock() {
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });

  return {
    event: { updateMany, deleteMany },
    updateMany,
    deleteMany,
  };
}

let mockPrisma: ReturnType<typeof buildPrismaMock>;

beforeEach(() => {
  mockPrisma = buildPrismaMock();
});

vi.mock("@/lib/db/client", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

describe("runCleanup", () => {
  it("soft-deletes expired events (endTime < now)", async () => {
    mockPrisma.event.updateMany.mockResolvedValue({ count: 5 });
    mockPrisma.event.deleteMany.mockResolvedValue({ count: 3 });

    const { runCleanup } = await import("./cleanup");
    const result = await runCleanup();

    expect(result.softDeleted).toBe(5);
    expect(result.hardDeleted).toBe(3);

    const updateCall = mockPrisma.event.updateMany.mock.calls[0][0];
    expect(updateCall.data).toEqual({ isActive: false });
    expect(updateCall.where.isActive).toBe(true);
    expect(updateCall.where.OR).toBeDefined();
  });

  it("soft-delete includes fallback to startTime when endTime is null", async () => {
    const { runCleanup } = await import("./cleanup");
    await runCleanup();

    const updateCall = mockPrisma.event.updateMany.mock.calls[0][0];
    const orClauses = updateCall.where.OR as Array<Record<string, unknown>>;

    const hasEndTimeFallback = orClauses.some(
      (c) => "endTime" in c && c.endTime != null && typeof c.endTime === "object" && "lt" in (c.endTime as object)
    );
    const hasStartTimeFallback = orClauses.some(
      (c) => "endTime" in c && c.endTime === null && "startTime" in c
    );

    expect(hasEndTimeFallback).toBe(true);
    expect(hasStartTimeFallback).toBe(true);
  });

  it("hard-deletes only events with NO GoingEvent rows", async () => {
    const { runCleanup } = await import("./cleanup");
    await runCleanup();

    const deleteCall = mockPrisma.event.deleteMany.mock.calls[0][0];
    expect(deleteCall.where.goingUsers).toEqual({ none: {} });
  });

  it("hard-delete includes same expiry OR clause as soft-delete", async () => {
    const { runCleanup } = await import("./cleanup");
    await runCleanup();

    const deleteCall = mockPrisma.event.deleteMany.mock.calls[0][0];
    expect(deleteCall.where.OR).toBeDefined();
    const orClauses = deleteCall.where.OR as Array<Record<string, unknown>>;
    expect(orClauses.length).toBeGreaterThanOrEqual(2);
  });

  it("returns correct counts from both steps", async () => {
    mockPrisma.event.updateMany.mockResolvedValue({ count: 10 });
    mockPrisma.event.deleteMany.mockResolvedValue({ count: 7 });

    const { runCleanup } = await import("./cleanup");
    const result = await runCleanup();

    expect(result.softDeleted).toBe(10);
    expect(result.hardDeleted).toBe(7);
  });

  it("does NOT issue an unconditional delete (no delete without goingUsers filter)", async () => {
    const { runCleanup } = await import("./cleanup");
    await runCleanup();

    const deleteCall = mockPrisma.event.deleteMany.mock.calls[0][0];
    expect(deleteCall.where.goingUsers).toBeDefined();
    expect(deleteCall.where.goingUsers).not.toBeNull();
  });

  it("soft-delete targets only currently active events", async () => {
    const { runCleanup } = await import("./cleanup");
    await runCleanup();

    const updateCall = mockPrisma.event.updateMany.mock.calls[0][0];
    expect(updateCall.where.isActive).toBe(true);
  });

  it("hard-delete does not filter on isActive (soft-deleted events should also be cleaned)", async () => {
    const { runCleanup } = await import("./cleanup");
    await runCleanup();

    const deleteCall = mockPrisma.event.deleteMany.mock.calls[0][0];
    expect(deleteCall.where.isActive).toBeUndefined();
  });
});
