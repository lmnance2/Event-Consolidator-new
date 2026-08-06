import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
    goingEvent: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    eventReminder: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { POST, DELETE } from "@/app/api/events/[id]/going/route";

const mockAuth = vi.mocked(auth);
const mockEventFind = vi.mocked(prisma.event.findUnique);
const mockGoingCreate = vi.mocked(prisma.goingEvent.create);
const mockGoingDeleteMany = vi.mocked(prisma.goingEvent.deleteMany);
const mockReminderUpdateMany = vi.mocked(prisma.eventReminder.updateMany);
const mockReminderCreate = vi.mocked(prisma.eventReminder.create);
const mockTransaction = vi.mocked(prisma.$transaction);

const SESSION = { user: { id: "user-1" } };
const PARAMS = Promise.resolve({ id: "evt-1" });

const FAR_FUTURE_START = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const NEAR_START = new Date(Date.now() + 23 * 60 * 60 * 1000);

function makeReq(): Request {
  return new Request("http://localhost/api/events/evt-1/going", { method: "POST" });
}

function makeDeleteReq(): Request {
  return new Request("http://localhost/api/events/evt-1/going", { method: "DELETE" });
}

interface FakeGoingTx {
  goingEvent: { create: ReturnType<typeof vi.fn> };
  eventReminder: { updateMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
}

// Drives the POST interactive $transaction callback with a fake tx object.
// mockGoingCreate and mock*Reminder are the outer mocks — we wire the tx
// methods to them so assertions on the outer mocks still work.
function setupPostTransactionMock() {
  mockTransaction.mockImplementationOnce(async (fn: unknown) => {
    const tx: FakeGoingTx = {
      goingEvent: { create: mockGoingCreate },
      eventReminder: {
        updateMany: mockReminderUpdateMany,
        create: mockReminderCreate,
      },
    };
    return (fn as (tx: FakeGoingTx) => Promise<void>)(tx);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/events/[id]/going", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
    expect(mockEventFind).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown event", async () => {
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
    mockEventFind.mockResolvedValueOnce({
      startTime: FAR_FUTURE_START,
      isActive: false,
    } as never);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Not found");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("returns 200 { going: true } on first Going, creates PENDING reminder (inside tx)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce({
      startTime: FAR_FUTURE_START,
      isActive: true,
    } as never);
    setupPostTransactionMock();
    mockGoingCreate.mockResolvedValueOnce({} as never);
    mockReminderUpdateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockReminderCreate.mockResolvedValueOnce({} as never);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { going: boolean };
    expect(json.going).toBe(true);

    // goingEvent.create must be called inside the transaction
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockGoingCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", eventId: "evt-1" },
    });

    // Reminder create must also be inside the same transaction
    expect(mockReminderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          eventId: "evt-1",
          status: "PENDING",
        }),
      })
    );

    const createCall = mockReminderCreate.mock.calls[0]![0];
    const sendAt = (createCall as { data: { sendAt: Date } }).data.sendAt;
    expect(sendAt.getTime()).toBeCloseTo(
      FAR_FUTURE_START.getTime() - 24 * 60 * 60 * 1000,
      -3
    );
  });

  it("returns 200 { going: true } on idempotent second Going (P2002)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce({
      startTime: FAR_FUTURE_START,
      isActive: true,
    } as never);
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    Object.setPrototypeOf(p2002, (await import("@prisma/client/runtime/library")).PrismaClientKnownRequestError.prototype);
    mockTransaction.mockRejectedValueOnce(p2002);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { going: boolean };
    expect(json.going).toBe(true);
    expect(mockReminderCreate).not.toHaveBeenCalled();
  });

  it("returns 200 { going: true } for event < 24h out, does NOT create reminder", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce({
      startTime: NEAR_START,
      isActive: true,
    } as never);
    // Transaction is still called (for goingEvent.create), but no reminder is created.
    setupPostTransactionMock();
    mockGoingCreate.mockResolvedValueOnce({} as never);

    const res = await POST(makeReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { going: boolean };
    expect(json.going).toBe(true);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockReminderCreate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/events/[id]/going", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 200 { going: false }, transitions PENDING reminder to CANCELLED", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockGoingDeleteMany.mockResolvedValueOnce({ count: 1 } as never);
    mockReminderUpdateMany.mockResolvedValueOnce({ count: 1 } as never);
    mockTransaction.mockResolvedValueOnce([{ count: 1 }, { count: 1 }] as never);

    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { going: boolean };
    expect(json.going).toBe(false);
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it("does not cancel reminders in statuses other than PENDING", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockGoingDeleteMany.mockResolvedValueOnce({ count: 1 } as never);
    mockReminderUpdateMany.mockResolvedValueOnce({ count: 0 } as never);
    mockTransaction.mockResolvedValueOnce([{ count: 1 }, { count: 0 }] as never);

    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
  });
});
