import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    userPreferences: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { GET, PATCH } from "@/app/api/users/preferences/route";

const mockAuth = vi.mocked(auth);
const mockPrefsFind = vi.mocked(prisma.userPreferences.findUnique);
const mockPrefsUpdate = vi.mocked(prisma.userPreferences.update);
const mockSubFind = vi.mocked(prisma.subscription.findUnique);

const FREE_SESSION = { user: { id: "user-free" } };
const PRO_SESSION = { user: { id: "user-pro" } };

const STORED_PREFS = {
  id: "pref-1",
  userId: "user-free",
  disabledCategories: [],
  maxDistanceMiles: 25,
  dateRangeDays: 30,
  priceMin: null,
  priceMax: null,
  experienceType: "BOTH",
  familyFriendly: false,
};

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost/api/users/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/users/preferences", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  it("returns preferences for authenticated user", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockPrefsFind.mockResolvedValueOnce(STORED_PREFS as never);
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(STORED_PREFS);
  });

  it("returns 404 when preferences row not found", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockPrefsFind.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/users/preferences", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it("empty body {} → 200, update called with empty data, returns DB row unchanged", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubFind.mockResolvedValueOnce({ status: "FREE" } as never);
    mockPrefsUpdate.mockResolvedValueOnce(STORED_PREFS as never);

    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(200);
    expect(mockPrefsUpdate).toHaveBeenCalledWith({
      where: { userId: "user-free" },
      data: {},
    });
    const json = await res.json();
    expect(json).toEqual(STORED_PREFS);
  });

  it("free user (FREE) → experienceType and familyFriendly stripped, not sent to DB", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubFind.mockResolvedValueOnce({ status: "FREE" } as never);
    mockPrefsUpdate.mockResolvedValueOnce(STORED_PREFS as never);

    await PATCH(makeRequest({ experienceType: "INDOOR", familyFriendly: true }));

    const callArg = mockPrefsUpdate.mock.calls[0]![0];
    expect(callArg.data).not.toHaveProperty("experienceType");
    expect(callArg.data).not.toHaveProperty("familyFriendly");
  });

  it("free user (PAST_DUE) → Pro fields stripped identically to FREE", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubFind.mockResolvedValueOnce({ status: "PAST_DUE" } as never);
    mockPrefsUpdate.mockResolvedValueOnce(STORED_PREFS as never);

    await PATCH(makeRequest({ experienceType: "OUTDOOR", familyFriendly: false }));

    const callArg = mockPrefsUpdate.mock.calls[0]![0];
    expect(callArg.data).not.toHaveProperty("experienceType");
    expect(callArg.data).not.toHaveProperty("familyFriendly");
  });

  it("pro user (ACTIVE) → experienceType persisted to DB", async () => {
    mockAuth.mockResolvedValueOnce(PRO_SESSION as never);
    mockSubFind.mockResolvedValueOnce({ status: "ACTIVE" } as never);
    const proPrefs = { ...STORED_PREFS, userId: "user-pro", experienceType: "INDOOR" };
    mockPrefsUpdate.mockResolvedValueOnce(proPrefs as never);

    const res = await PATCH(makeRequest({ experienceType: "INDOOR" }));

    const callArg = mockPrefsUpdate.mock.calls[0]![0];
    expect(callArg.data).toHaveProperty("experienceType", "INDOOR");
    expect(res.status).toBe(200);
    const json = await res.json() as { experienceType: string };
    expect(json.experienceType).toBe("INDOOR");
  });

  it("invalid body (maxDistanceMiles: 999) → 400 with generic message, console.error called", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await PATCH(makeRequest({ maxDistanceMiles: 999 }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid request");
    expect(spy).toHaveBeenCalledWith(
      "[preferences] Invalid PATCH body:",
      expect.any(Array)
    );
  });

  it("Prisma throws → 500 with generic message, console.error called with underlying error", async () => {
    mockAuth.mockResolvedValueOnce(FREE_SESSION as never);
    mockSubFind.mockResolvedValueOnce({ status: "FREE" } as never);
    const dbError = new Error("DB connection refused");
    mockPrefsUpdate.mockRejectedValueOnce(dbError);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await PATCH(makeRequest({}));
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Something went wrong");
    expect(spy).toHaveBeenCalledWith("[preferences PATCH]", dbError);
  });
});
