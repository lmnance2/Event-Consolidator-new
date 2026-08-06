import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/client", () => ({
  prisma: {
    eventSource: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/client";
import { getPrimaryTicketUrl } from "@/lib/events/primary-source";

const mockFindFirst = vi.mocked(prisma.eventSource.findFirst);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getPrimaryTicketUrl", () => {
  it("returns null when no sources exist for the event", async () => {
    mockFindFirst.mockResolvedValueOnce(null as never);
    const result = await getPrimaryTicketUrl("evt-1");
    expect(result).toBeNull();
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { eventId: "evt-1" },
      orderBy: { createdAt: "asc" },
      select: { ticketUrl: true },
    });
  });

  it("returns the ticketUrl when a single source exists", async () => {
    mockFindFirst.mockResolvedValueOnce({
      ticketUrl: "https://tm.com/evt-1",
    } as never);
    const result = await getPrimaryTicketUrl("evt-1");
    expect(result).toBe("https://tm.com/evt-1");
  });

  it("returns the oldest source's ticketUrl when multiple sources exist (orderBy createdAt asc handled by DB)", async () => {
    // The DB returns only the first row due to findFirst + orderBy, so the
    // mock simulates the winner already selected.
    mockFindFirst.mockResolvedValueOnce({
      ticketUrl: "https://tm.com/oldest",
    } as never);
    const result = await getPrimaryTicketUrl("evt-multi");
    expect(result).toBe("https://tm.com/oldest");
    // Verify the sort order passed to Prisma is createdAt asc (stable across runs).
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "asc" },
      })
    );
  });
});
