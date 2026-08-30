import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    friendRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    friendship: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { PATCH, DELETE } from "@/app/api/friends/requests/[id]/route";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const mockAuth = vi.mocked(auth);
const mockRequestFind = vi.mocked(prisma.friendRequest.findUnique);
const mockRequestUpdate = vi.mocked(prisma.friendRequest.update);
const mockRequestDelete = vi.mocked(prisma.friendRequest.delete);
const mockTransaction = vi.mocked(prisma.$transaction);

const SESSION = { user: { id: "to-user" } };
const PARAMS = Promise.resolve({ id: "req-1" });

function makePatchReq(action: string): Request {
  return new Request("http://localhost/api/friends/requests/req-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

function makeDeleteReq(): Request {
  return new Request("http://localhost/api/friends/requests/req-1", { method: "DELETE" });
}

interface FakeTx {
  friendRequest: { update: ReturnType<typeof vi.fn> };
  friendship: { upsert: ReturnType<typeof vi.fn> };
}

// Helper to simulate the serializable transaction
function setupAcceptTransaction(shouldThrow?: Error) {
  mockTransaction.mockImplementationOnce(async (fn: unknown) => {
    if (shouldThrow) throw shouldThrow;
    const tx: FakeTx = {
      friendRequest: { update: vi.fn().mockResolvedValueOnce({}) },
      friendship: { upsert: vi.fn().mockResolvedValueOnce({}) },
    };
    return (fn as (tx: FakeTx) => Promise<unknown>)(tx);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("PATCH /api/friends/requests/[id]", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await PATCH(makePatchReq("accept"), { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid action", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const res = await PATCH(
      new Request("http://localhost/api/friends/requests/req-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "invalid" }),
      }),
      { params: PARAMS }
    );
    expect(res.status).toBe(400);
  });

  it("IDOR: returns generic 404 when request belongs to a different user", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    // The request is for "victim-user", not "to-user"
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "from-1",
      toUserId: "victim-user",
      status: "PENDING",
    } as never);

    const res = await PATCH(makePatchReq("accept"), { params: PARAMS });
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Not found");
  });

  it("IDOR: returns generic 404 when request row does not exist", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockRequestFind.mockResolvedValueOnce(null as never);

    const res = await PATCH(makePatchReq("accept"), { params: PARAMS });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-PENDING request (already accepted)", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "from-1",
      toUserId: "to-user",
      status: "ACCEPTED",
    } as never);

    const res = await PATCH(makePatchReq("accept"), { params: PARAMS });
    expect(res.status).toBe(404);
  });

  it("decline: updates status to DECLINED", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "from-1",
      toUserId: "to-user",
      status: "PENDING",
    } as never);
    mockRequestUpdate.mockResolvedValueOnce({} as never);

    const res = await PATCH(makePatchReq("decline"), { params: PARAMS });
    expect(res.status).toBe(200);
    expect(mockRequestUpdate).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { status: "DECLINED" },
    });
  });

  it("accept: uses Serializable transaction", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "from-1",
      toUserId: "to-user",
      status: "PENDING",
    } as never);
    setupAcceptTransaction();

    await PATCH(makePatchReq("accept"), { params: PARAMS });

    expect(mockTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "Serializable" }
    );
  });

  it("accept: returns 200 on success", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "from-1",
      toUserId: "to-user",
      status: "PENDING",
    } as never);
    setupAcceptTransaction();

    const res = await PATCH(makePatchReq("accept"), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("accept race: P2002 on Friendship upsert remaps to idempotent 200", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "from-1",
      toUserId: "to-user",
      status: "PENDING",
    } as never);

    const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    Object.setPrototypeOf(
      p2002,
      PrismaClientKnownRequestError.prototype
    );
    setupAcceptTransaction(p2002);

    const res = await PATCH(makePatchReq("accept"), { params: PARAMS });
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });
});

describe("DELETE /api/friends/requests/[id]", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it("IDOR: returns generic 404 when request belongs to different sender", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    // session.user.id = "to-user", but request.fromUserId = "attacker"
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "attacker",
      status: "PENDING",
    } as never);

    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(404);
  });

  it("returns 404 when request not PENDING (already accepted)", async () => {
    // SESSION user IS the sender, but status is not PENDING
    mockAuth.mockResolvedValueOnce({ user: { id: "from-1" } } as never);
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "from-1",
      status: "ACCEPTED",
    } as never);

    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(404);
  });

  it("deletes the request and returns 200 when caller is sender and PENDING", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "from-1" } } as never);
    mockRequestFind.mockResolvedValueOnce({
      fromUserId: "from-1",
      status: "PENDING",
    } as never);
    mockRequestDelete.mockResolvedValueOnce({} as never);

    const res = await DELETE(makeDeleteReq(), { params: PARAMS });
    expect(res.status).toBe(200);
    expect(mockRequestDelete).toHaveBeenCalledWith({ where: { id: "req-1" } });
  });
});
