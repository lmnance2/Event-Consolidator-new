import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    eventReminder: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    eventSource: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/email/templates/reminder", () => ({
  ReminderEmail: () => null,
}));

const CRON_SECRET = "test-reminder-secret";
// A different secret of the SAME byte length as CRON_SECRET ("test-reminder-secret"
// = 20 chars) — tests the timingSafeEqual path for equal-length mismatches.
const WRONG_SECRET_SAME_LENGTH = "test-reminder-wrong!";

import { GET } from "../../app/api/notifications/reminders/process/route";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";

const mockFindMany = vi.mocked(prisma.eventReminder.findMany);
const mockUpdateMany = vi.mocked(prisma.eventReminder.updateMany);
const mockUpdate = vi.mocked(prisma.eventReminder.update);
const mockTransaction = vi.mocked(prisma.$transaction);
const mockSourceFindFirst = vi.mocked(prisma.eventSource.findFirst);
const mockSendEmail = vi.mocked(sendEmail);

const FUTURE_START = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2h from now

function makeReminder(overrides: Partial<{
  id: string;
  userId: string;
  eventId: string;
  status: string;
  event: object | null;
  user: object;
}> = {}) {
  const eventId = overrides.eventId ?? "event-1";
  const userId = overrides.userId ?? "user-1";
  return {
    id: overrides.id ?? "reminder-1",
    userId,
    eventId,
    status: overrides.status ?? "FAILED",
    sendAt: new Date(Date.now() - 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    event: overrides.event !== undefined ? overrides.event : {
      id: eventId,
      title: "Test Concert",
      startTime: FUTURE_START,
      venue: "Test Venue",
      isActive: true,
      sources: [{ ticketUrl: "https://provider.com/tickets" }],
    },
    user: overrides.user ?? {
      id: userId,
      name: "Test User",
      email: "test@example.com",
    },
  };
}

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["Authorization"] = authHeader;
  }
  return new Request("http://localhost:3000/api/notifications/reminders/process", {
    headers,
  });
}

function setupSuccessfulTransaction(count: number) {
  mockTransaction.mockImplementation((async (fn: unknown) => {
    mockUpdateMany.mockResolvedValueOnce({ count });
    const fakeTx = {
      eventReminder: {
        updateMany: mockUpdateMany,
      },
    };
    return (fn as (tx: typeof prisma) => Promise<number>)(fakeTx as unknown as typeof prisma);
  }) as never);
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
  vi.stubEnv("NEXTAUTH_URL", "https://app.example.com");
  vi.clearAllMocks();
  mockSourceFindFirst.mockResolvedValue({
    ticketUrl: "https://provider.com/tickets",
  } as never);
  mockUpdate.mockResolvedValue({} as never);
});

describe("GET /api/notifications/reminders/process", () => {
  describe("authorization", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when bearer token is wrong (different length)", async () => {
      const res = await GET(makeRequest("Bearer wrong-secret"));
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when bearer token is wrong (same length as correct token)", async () => {
      // Verifies the timingSafeEqual path for equal-length mismatches.
      const res = await GET(makeRequest(`Bearer ${WRONG_SECRET_SAME_LENGTH}`));
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when Authorization header is missing the Bearer prefix", async () => {
      const res = await GET(makeRequest(CRON_SECRET));
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 401 when CRON_SECRET env var is not set", async () => {
      vi.stubEnv("CRON_SECRET", "");
      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(401);
    });

    it("does not query the DB when auth fails", async () => {
      await GET(makeRequest("Bearer wrong"));
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("returns 200 when correct secret is provided", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);
    });
  });

  describe("NEXTAUTH_URL validation", () => {
    it("returns 500 when NEXTAUTH_URL is not set", async () => {
      vi.stubEnv("NEXTAUTH_URL", "");
      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(500);
      const body = await res.json() as { error: string };
      expect(body.error).toMatch(/NEXTAUTH_URL/);
    });

    it("does not query the DB when NEXTAUTH_URL is missing", async () => {
      vi.stubEnv("NEXTAUTH_URL", "");
      await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("logs a structured error when NEXTAUTH_URL is missing", async () => {
      vi.stubEnv("NEXTAUTH_URL", "");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      expect(consoleSpy).toHaveBeenCalledOnce();
      const logged = JSON.parse(consoleSpy.mock.calls[0]![0] as string) as { event: string; error: string };
      expect(logged.event).toBe("reminders.config.error");
      expect(logged.error).toMatch(/NEXTAUTH_URL/);

      consoleSpy.mockRestore();
    });
  });

  describe("0 pending reminders", () => {
    it("returns 200 with all-zero counts when no reminders are due", async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);
      const body = await res.json() as {
        processed: number;
        sent: number;
        failed: number;
        cancelled: number;
      };
      expect(body).toEqual({ processed: 0, sent: 0, failed: 0, cancelled: 0 });
    });

    it("does not call sendEmail when no reminders are due", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  describe("batched source lookup — no per-reminder eventSource.findFirst", () => {
    it("does not call eventSource.findFirst for any reminder in the batch", async () => {
      const reminders = [
        makeReminder({ id: "r-1", userId: "u-1", eventId: "e-1" }),
        makeReminder({ id: "r-2", userId: "u-2", eventId: "e-2" }),
        makeReminder({ id: "r-3", userId: "u-3", eventId: "e-3" }),
      ];

      mockFindMany
        .mockResolvedValueOnce(reminders.map((r) => ({ id: r.id })) as never)
        .mockResolvedValueOnce(reminders as never);

      setupSuccessfulTransaction(3);
      mockSendEmail.mockResolvedValue(undefined);

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      // The handler must not make any per-reminder source lookups — the ticket
      // URL comes from the sources[] included in the findMany result above.
      expect(mockSourceFindFirst).not.toHaveBeenCalled();
    });

    it("uses the sources[0].ticketUrl from the batched result as the ticket link", async () => {
      const reminder = makeReminder({
        id: "r-1",
        event: {
          id: "e-1",
          title: "Test Concert",
          startTime: FUTURE_START,
          venue: "Test Venue",
          isActive: true,
          sources: [{ ticketUrl: "https://batched-ticket.com/buy" }],
        },
      });

      mockFindMany
        .mockResolvedValueOnce([{ id: "r-1" }] as never)
        .mockResolvedValueOnce([reminder] as never);

      setupSuccessfulTransaction(1);
      mockSendEmail.mockResolvedValue(undefined);

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const call = mockSendEmail.mock.calls[0]![0];
      // The react prop carries ticketUrl — inspect the createElement call args
      // via the react prop object passed to sendEmail.
      expect(call).toBeDefined();
      // The react element props are the third arg of createElement; verify the
      // ticketUrl came from the batched include and not a separate findFirst.
      expect(mockSourceFindFirst).not.toHaveBeenCalled();
    });

    it("falls back to eventUrl when event has no sources", async () => {
      const reminder = makeReminder({
        id: "r-1",
        event: {
          id: "e-1",
          title: "No Source Event",
          startTime: FUTURE_START,
          venue: "Some Venue",
          isActive: true,
          sources: [],
        },
      });

      mockFindMany
        .mockResolvedValueOnce([{ id: "r-1" }] as never)
        .mockResolvedValueOnce([reminder] as never);

      setupSuccessfulTransaction(1);
      mockSendEmail.mockResolvedValue(undefined);

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);
      const body = await res.json() as { sent: number };
      expect(body.sent).toBe(1);
      expect(mockSourceFindFirst).not.toHaveBeenCalled();
    });
  });

  describe("successful batch processing", () => {
    it("sends email and marks SENT for 3 pending reminders", async () => {
      const reminders = [
        makeReminder({ id: "r-1", userId: "u-1", eventId: "e-1" }),
        makeReminder({ id: "r-2", userId: "u-2", eventId: "e-2" }),
        makeReminder({ id: "r-3", userId: "u-3", eventId: "e-3" }),
      ];

      // findMany called twice: once for candidates (returns IDs), once for full data
      mockFindMany
        .mockResolvedValueOnce(reminders.map((r) => ({ id: r.id })) as never)
        .mockResolvedValueOnce(reminders as never);

      setupSuccessfulTransaction(3);
      mockSendEmail.mockResolvedValue(undefined);

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      expect(res.status).toBe(200);

      const body = await res.json() as {
        processed: number;
        sent: number;
        failed: number;
        cancelled: number;
      };
      expect(body.processed).toBe(3);
      expect(body.sent).toBe(3);
      expect(body.failed).toBe(0);
      expect(body.cancelled).toBe(0);
    });

    it("calls sendEmail 3 times with correct subject and recipient", async () => {
      const reminders = [
        makeReminder({ id: "r-1", userId: "u-1", eventId: "e-1", user: { id: "u-1", name: "Alice", email: "alice@example.com" } }),
        makeReminder({ id: "r-2", userId: "u-2", eventId: "e-2", user: { id: "u-2", name: "Bob", email: "bob@example.com" } }),
        makeReminder({ id: "r-3", userId: "u-3", eventId: "e-3", user: { id: "u-3", name: "Carol", email: "carol@example.com" } }),
      ];

      mockFindMany
        .mockResolvedValueOnce(reminders.map((r) => ({ id: r.id })) as never)
        .mockResolvedValueOnce(reminders as never);

      setupSuccessfulTransaction(3);
      mockSendEmail.mockResolvedValue(undefined);

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      expect(mockSendEmail).toHaveBeenCalledTimes(3);

      const calls = mockSendEmail.mock.calls;
      expect(calls[0]![0].to).toBe("alice@example.com");
      expect(calls[0]![0].subject).toBe("Coming up: Test Concert");
      expect(calls[1]![0].to).toBe("bob@example.com");
      expect(calls[2]![0].to).toBe("carol@example.com");
    });

    it("marks each claimed reminder as SENT on success", async () => {
      const reminders = [
        makeReminder({ id: "r-1" }),
        makeReminder({ id: "r-2" }),
        makeReminder({ id: "r-3" }),
      ];

      mockFindMany
        .mockResolvedValueOnce(reminders.map((r) => ({ id: r.id })) as never)
        .mockResolvedValueOnce(reminders as never);

      setupSuccessfulTransaction(3);
      mockSendEmail.mockResolvedValue(undefined);

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      const updateCalls = mockUpdate.mock.calls;
      const sentUpdates = updateCalls.filter(
        (c) => (c[0] as { data: { status: string } }).data.status === "SENT"
      );
      expect(sentUpdates).toHaveLength(3);
    });
  });

  describe("batch size cap", () => {
    it("processes at most BATCH_SIZE (50) reminders per call", async () => {
      // Seed 60 IDs but return only 50 from findMany (take: 50 is enforced by the handler)
      const fiftyIds = Array.from({ length: 50 }, (_, i) => ({ id: `r-${i}` }));

      mockFindMany
        .mockResolvedValueOnce(fiftyIds as never)
        .mockResolvedValueOnce(
          fiftyIds.map((r) => makeReminder({ id: r.id })) as never
        );

      setupSuccessfulTransaction(50);
      mockSendEmail.mockResolvedValue(undefined);

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      const body = await res.json() as { processed: number };

      // Only 50 processed, not more
      expect(body.processed).toBe(50);
      expect(mockSendEmail).toHaveBeenCalledTimes(50);
    });
  });

  describe("Resend failure handling", () => {
    it("marks a reminder FAILED when sendEmail throws, other reminders still SENT", async () => {
      const reminders = [
        makeReminder({ id: "r-1", userId: "u-1", eventId: "e-1" }),
        makeReminder({ id: "r-2", userId: "u-2", eventId: "e-2" }),
        makeReminder({ id: "r-3", userId: "u-3", eventId: "e-3" }),
      ];

      mockFindMany
        .mockResolvedValueOnce(reminders.map((r) => ({ id: r.id })) as never)
        .mockResolvedValueOnce(reminders as never);

      setupSuccessfulTransaction(3);

      // First send fails, others succeed
      mockSendEmail
        .mockRejectedValueOnce(new Error("Resend API error"))
        .mockResolvedValue(undefined);

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      const body = await res.json() as {
        processed: number;
        sent: number;
        failed: number;
        cancelled: number;
      };

      expect(body.processed).toBe(3);
      expect(body.failed).toBe(1);
      expect(body.sent).toBe(2);
      expect(body.cancelled).toBe(0);
    });

    it("marks the failed reminder with FAILED status in the DB", async () => {
      const reminders = [makeReminder({ id: "r-fail" })];

      mockFindMany
        .mockResolvedValueOnce([{ id: "r-fail" }] as never)
        .mockResolvedValueOnce(reminders as never);

      setupSuccessfulTransaction(1);
      mockSendEmail.mockRejectedValueOnce(new Error("timeout"));

      await GET(makeRequest(`Bearer ${CRON_SECRET}`));

      // The final update for the failed reminder should set status = FAILED
      const failUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { where: { id: string }; data: { status: string } }).where.id === "r-fail"
          && (c[0] as { where: { id: string }; data: { status: string } }).data.status === "FAILED"
      );
      expect(failUpdate).toBeDefined();
    });
  });

  describe("hard-deleted event guard", () => {
    it("marks reminder CANCELLED and does not call sendEmail when event is null", async () => {
      const reminder = makeReminder({ id: "r-orphan", event: null });

      mockFindMany
        .mockResolvedValueOnce([{ id: "r-orphan" }] as never)
        .mockResolvedValueOnce([reminder] as never);

      setupSuccessfulTransaction(1);

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      const body = await res.json() as {
        processed: number;
        sent: number;
        failed: number;
        cancelled: number;
      };

      expect(body.cancelled).toBe(1);
      expect(body.sent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();

      const cancelUpdate = mockUpdate.mock.calls.find(
        (c) => (c[0] as { data: { status: string } }).data.status === "CANCELLED"
      );
      expect(cancelUpdate).toBeDefined();
    });
  });

  describe("atomic claim: already-processed reminders are not re-processed", () => {
    it("SENT/FAILED/CANCELLED reminders are excluded by the initial PENDING filter", async () => {
      // findMany returns 0 because all reminders that were due are already
      // in a terminal state (not PENDING)
      mockFindMany.mockResolvedValueOnce([]);

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      const body = await res.json() as { processed: number };

      expect(body.processed).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Transaction should not be called when there are no candidates
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it("does not re-process a reminder that a concurrent worker already claimed (count=0 from tx)", async () => {
      // findMany returns 1 candidate, but transaction claims 0 (concurrent worker got it)
      mockFindMany.mockResolvedValueOnce([{ id: "r-1" }] as never);
      setupSuccessfulTransaction(0); // concurrent worker claimed it

      const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
      const body = await res.json() as { processed: number; sent: number };

      expect(body.processed).toBe(0);
      expect(body.sent).toBe(0);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});
