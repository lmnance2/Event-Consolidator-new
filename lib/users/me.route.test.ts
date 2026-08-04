import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: {
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/geo/geocode", () => ({
  geocodeZip: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { geocodeZip } from "@/lib/geo/geocode";
import { PATCH, DELETE } from "@/app/api/users/me/route";

const mockAuth = vi.mocked(auth);
const mockUserUpdate = vi.mocked(prisma.user.update);
const mockUserDelete = vi.mocked(prisma.user.delete);
const mockGeocodeZip = vi.mocked(geocodeZip);

const SESSION = { user: { id: "user-1" } };

const STORED_USER = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  zipCode: "10001",
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/users/me", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await PATCH(makeRequest({ name: "Bob" }));
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  it("PATCH name → user.update called with { name }", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserUpdate.mockResolvedValueOnce(STORED_USER as never);

    const res = await PATCH(makeRequest({ name: "New Name" }));
    expect(res.status).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ name: "New Name" }),
      })
    );
  });

  it("PATCH zipCode → geocodeZip called; success → update includes lat/lng", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockGeocodeZip.mockResolvedValueOnce({ lat: 40.7128, lng: -74.006 });
    mockUserUpdate.mockResolvedValueOnce(STORED_USER as never);

    await PATCH(makeRequest({ zipCode: "10001" }));

    expect(mockGeocodeZip).toHaveBeenCalledWith("10001");
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zipCode: "10001",
          latitude: 40.7128,
          longitude: -74.006,
        }),
      })
    );
  });

  it("PATCH zipCode → geocodeZip returns null → update sets latitude/longitude to null", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockGeocodeZip.mockResolvedValueOnce(null);
    mockUserUpdate.mockResolvedValueOnce(STORED_USER as never);

    await PATCH(makeRequest({ zipCode: "00000" }));

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zipCode: "00000",
          latitude: null,
          longitude: null,
        }),
      })
    );
  });

  it("unknown fields (email, passwordHash, id) stripped by Zod — update never receives them", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserUpdate.mockResolvedValueOnce(STORED_USER as never);

    await PATCH(
      makeRequest({ name: "Valid Name", email: "hack@evil.com", passwordHash: "x", id: "other-id", userId: "other" })
    );

    const callArg = mockUserUpdate.mock.calls[0]![0];
    expect(callArg.data).not.toHaveProperty("email");
    expect(callArg.data).not.toHaveProperty("passwordHash");
    expect(callArg.data).not.toHaveProperty("id");
    expect(callArg.data).not.toHaveProperty("userId");
  });

  it("invalid ZIP (letters) → 400 with generic message, console.error called", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await PATCH(makeRequest({ zipCode: "abcde" }));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid request");
    expect(spy).toHaveBeenCalledWith("[me] Invalid PATCH body:", expect.any(Array));
  });

  it("Prisma throws on PATCH → 500 with generic error, console.error called", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const dbError = new Error("DB failure");
    mockUserUpdate.mockRejectedValueOnce(dbError);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await PATCH(makeRequest({ name: "Alice" }));
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Something went wrong");
    expect(spy).toHaveBeenCalledWith("[me PATCH]", dbError);
  });
});

describe("DELETE /api/users/me", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("authenticated DELETE → prisma.user.delete called with session user id, returns 204", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockUserDelete.mockResolvedValueOnce(undefined as never);

    const res = await DELETE();
    expect(res.status).toBe(204);
    expect(mockUserDelete).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
  });

  it("Prisma throws on delete → 500 with generic error, console.error called", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    const dbError = new Error("FK constraint violation");
    mockUserDelete.mockRejectedValueOnce(dbError);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await DELETE();
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Something went wrong");
    expect(spy).toHaveBeenCalledWith("[me DELETE]", dbError);
  });
});
