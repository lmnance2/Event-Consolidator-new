import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    subscription: { findUnique: vi.fn() },
    savedEvent: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { POST, DELETE } from "@/app/api/events/[id]/save/route";
import { FREE_SAVE_LIMIT } from "@/lib/subscription/constants";

const mockAuth = vi.mocked(auth);
const mockEventFind = vi.mocked(prisma.event.findUnique);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockSubscriptionFind = vi.mocked(prisma.subscription.findUnique);
const mockSavedCount = vi.mocked(prisma.savedEvent.count);
const mockCreate = vi.mocked(prisma.savedEvent.create);
const mockDeleteMany = vi.mocked(prisma.savedEvent.deleteMany);

const SESSION = { user: { id: "user-1" } };
const PARAMS = Promise.resolve({ id: "evt-1" });
const ACTIVE_EVENT = { id: "evt-1", isActive: true };
const INACTIVE_EVENT = { id: "evt-2", isActive: false };

function makeReq(): Request {
  return new Request("http://localhost/api/events/evt-1/save", { method: "POST" });
}

function makeDeleteReq(): Request {
  return new Request("http://localhost/api/events/evt-1/save", { method: "DELETE" });
}

interface FakeTx {
  savedEvent: { count: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
}

// Subscription lookup happens OUTSIDE the tx (pre-flight). Count + create
// happen inside the tx under Serializable isolation.
function setupSubscription(subscriptionStatus: string | null) {
  mockSubscriptionFind.mockResolvedValueOnce(
    (subscriptionStatus !== null ? { status: subscriptionStatus } : null) as never
  );
}

function setupTransactionMock(savedCount: number, createResult?: unknown) {
  mockTransaction.mockImplementationOnce(async (fn: unknown) => {
    const tx: FakeTx = {
      savedEvent: {
        count: vi.fn().mockResolvedValueOnce(savedCount),
        create: vi.fn().mockResolvedValueOnce(createResult ?? {}),
      },
    };
    return (fn as (tx: FakeTx) => Promise<unknown>)(tx);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/events/[id]/save", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
    expect(mockEventFind).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown eventId (no event row)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(null as never);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Not found");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 404 for inactive event", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(INACTIVE_EVENT as never);

    const res = await POST(
      new Request("http://localhost/api/events/evt-2/save", { method: "POST" }),
      { params: Promise.resolve({ id: "evt-2" }) }
    );
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Not found");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 200 { saved: true } on first save (count=0, free user)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    setupSubscription("FREE");
    setupTransactionMock(0);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { saved: boolean };
    expect(json.saved).toBe(true);
  });

  it("returns 409 SAVE_LIMIT_REACHED when free user is at count=5", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    setupSubscription("FREE");
    setupTransactionMock(FREE_SAVE_LIMIT);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(409);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("SAVE_LIMIT_REACHED");
  });

  it("TOCTOU: transaction re-reads count; second concurrent caller at count=5 is rejected", async () => {
    // Simulates the race: two requests pass the pre-flight event check, then
    // inside the transaction the second caller re-reads count and finds 5
    // (because the first caller's create already committed).
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    setupSubscription("FREE");
    setupTransactionMock(5);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(409);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("SAVE_LIMIT_REACHED");
  });

  it("Serializable isolation: P2034 conflict remaps to 409 SAVE_LIMIT_REACHED", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    setupSubscription("FREE");
    const p2034 = Object.assign(new Error("Serialization failure"), { code: "P2034" });
    Object.setPrototypeOf(p2034, (await import("@prisma/client/runtime/library")).PrismaClientKnownRequestError.prototype);
    mockTransaction.mockRejectedValueOnce(p2034);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(409);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("SAVE_LIMIT_REACHED");
  });

  it("passes { isolationLevel: 'Serializable' } to $transaction", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    setupSubscription("FREE");
    setupTransactionMock(0);

    await POST(makeReq(), { params: PARAMS });

    expect(mockTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" }
    );
  });

  it("saves and $transaction is used (not a bare create outside tx)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    setupSubscription("FREE");
    setupTransactionMock(3);

    await POST(makeReq(), { params: PARAMS });

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSavedCount).not.toHaveBeenCalled();
  });

  it("allows Pro user to save when at count=5 (returns 200)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    setupSubscription("ACTIVE");
    setupTransactionMock(5);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { saved: boolean };
    expect(json.saved).toBe(true);
  });

  it("returns 200 { saved: true } on idempotent second save (P2002)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(ACTIVE_EVENT as never);
    setupSubscription("FREE");
    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    Object.setPrototypeOf(p2002, (await import("@prisma/client/runtime/library")).PrismaClientKnownRequestError.prototype);
    mockTransaction.mockRejectedValueOnce(p2002);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { saved: boolean };
    expect(json.saved).toBe(true);
  });
});

describe("DELETE /api/events/[id]/save", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 200 { saved: false } — idempotent even if row didn't exist", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockDeleteMany.mockResolvedValueOnce({ count: 0 } as never);

    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { saved: boolean };
    expect(json.saved).toBe(false);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", eventId: "evt-1" },
    });
  });
});
