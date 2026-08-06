import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    event: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/calendar/ics", () => ({
  buildIcsFile: vi.fn(() => "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { GET } from "@/app/api/events/[id]/ics/route";

const mockAuth = vi.mocked(auth);
const mockEventFind = vi.mocked(prisma.event.findUnique);

const SESSION = { user: { id: "user-1" } };
const PARAMS = Promise.resolve({ id: "evt-1" });

const STORED_EVENT = {
  id: "evt-1",
  title: "Test Concert",
  description: "A great show",
  startTime: new Date("2026-09-01T20:00:00.000Z"),
  endTime: new Date("2026-09-01T22:00:00.000Z"),
  venue: "Central Park",
  sources: [{ ticketUrl: "https://tm.com/evt-1" }],
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/events/[id]/ics", () => {
  it("returns 401 when no session", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await GET(new Request("http://localhost/api/events/evt-1/ics"), { params: PARAMS });
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
    expect(mockEventFind).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown eventId", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(null as never);

    const res = await GET(new Request("http://localhost/api/events/unknown/ics"), {
      params: Promise.resolve({ id: "unknown" }),
    });
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Not found");
  });

  it("returns 200 with correct Content-Type header", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(STORED_EVENT as never);

    const res = await GET(new Request("http://localhost/api/events/evt-1/ics"), { params: PARAMS });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
  });

  it("returns 200 with Content-Disposition attachment header", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(STORED_EVENT as never);

    const res = await GET(new Request("http://localhost/api/events/evt-1/ics"), { params: PARAMS });
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="event-evt-1.ics"');
  });

  it("response body starts with BEGIN:VCALENDAR", async () => {
    mockAuth.mockResolvedValueOnce(SESSION as never);
    mockEventFind.mockResolvedValueOnce(STORED_EVENT as never);

    const res = await GET(new Request("http://localhost/api/events/evt-1/ics"), { params: PARAMS });
    const text = await res.text();
    expect(text).toMatch(/^BEGIN:VCALENDAR/);
  });
});
