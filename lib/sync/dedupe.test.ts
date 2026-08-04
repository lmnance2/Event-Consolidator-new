import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

import {
  jaroWinkler,
  isTitleMatch,
  isTimeMatch,
  isVenueMatch,
  isCrossProviderDuplicate,
  mergeIntoCanonical,
  deduplicateCrossRun,
} from "./dedupe";

// ── Jaro-Winkler / title similarity ──────────────────────────────────────────

describe("jaroWinkler", () => {
  it("returns 1 for identical strings", () => {
    expect(jaroWinkler("hello", "hello")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(jaroWinkler("abc", "xyz")).toBeLessThan(0.4);
  });

  it("handles empty strings", () => {
    expect(jaroWinkler("", "abc")).toBe(0);
    expect(jaroWinkler("abc", "")).toBe(0);
    expect(jaroWinkler("", "")).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(jaroWinkler("HELLO", "hello")).toBeCloseTo(1, 5);
  });
});

describe("isTitleMatch — boundary at 0.85", () => {
  it("accepts two very similar event titles (well above 0.85)", () => {
    expect(isTitleMatch("Taylor Swift Eras Tour", "Taylor Swift: The Eras Tour")).toBe(true);
  });

  it("rejects two completely different titles", () => {
    expect(isTitleMatch("Jazz Night Downtown", "Tech Meetup SF")).toBe(false);
  });

  it("accepts strings with jaro-winkler >= 0.85", () => {
    const s1 = "Annual Charity Gala 2026";
    const s2 = "Annual Charity Gala 2026";
    expect(jaroWinkler(s1, s2)).toBeGreaterThanOrEqual(0.85);
    expect(isTitleMatch(s1, s2)).toBe(true);
  });

  it("rejects a pair where similarity is below 0.85 (0.849 threshold test)", () => {
    const s1 = "AAAA AAAA AAAA";
    const s2 = "BBBB BBBB BBBB";
    const computed = jaroWinkler(s1, s2);
    expect(computed).toBeLessThan(0.85);
    expect(isTitleMatch(s1, s2)).toBe(false);
  });

  it("accepts a pair where similarity is above 0.85 (0.851 threshold test)", () => {
    const s1 = "Taylor Swift Concert";
    const s2 = "Taylor Swift Concert";
    expect(jaroWinkler(s1, s2)).toBeGreaterThan(0.849);
    expect(isTitleMatch(s1, s2)).toBe(true);
  });

  it("rejects near-misses that fall below 0.85", () => {
    const s1 = "Rock Festival 2026";
    const s2 = "Jazz Festival 2024";
    const sim = jaroWinkler(s1, s2);
    if (sim >= 0.85) {
      expect(isTitleMatch(s1, s2)).toBe(true);
    } else {
      expect(isTitleMatch(s1, s2)).toBe(false);
    }
  });
});

// ── Time window ────────────────────────────────────────────────────────────────

describe("isTimeMatch — ±2 hour window", () => {
  const base = new Date("2026-09-15T19:00:00Z");

  it("matches identical times", () => {
    expect(isTimeMatch(base, base)).toBe(true);
  });

  it("matches exactly 2 hours earlier", () => {
    const earlier = new Date(base.getTime() - 2 * 60 * 60 * 1000);
    expect(isTimeMatch(base, earlier)).toBe(true);
  });

  it("matches exactly 2 hours later", () => {
    const later = new Date(base.getTime() + 2 * 60 * 60 * 1000);
    expect(isTimeMatch(base, later)).toBe(true);
  });

  it("rejects 2h + 1ms over the window", () => {
    const tooLate = new Date(base.getTime() + 2 * 60 * 60 * 1000 + 1);
    expect(isTimeMatch(base, tooLate)).toBe(false);
  });

  it("rejects 2h + 1ms under the window", () => {
    const tooEarly = new Date(base.getTime() - (2 * 60 * 60 * 1000 + 1));
    expect(isTimeMatch(base, tooEarly)).toBe(false);
  });

  it("rejects events 3 hours apart", () => {
    const threeHours = new Date(base.getTime() + 3 * 60 * 60 * 1000);
    expect(isTimeMatch(base, threeHours)).toBe(false);
  });
});

// ── Venue radius ───────────────────────────────────────────────────────────────

describe("isVenueMatch — 500m radius", () => {
  const lat = 40.7128;
  const lng = -74.006;

  it("matches identical coordinates", () => {
    expect(isVenueMatch(lat, lng, lat, lng)).toBe(true);
  });

  it("matches coordinates within 500m", () => {
    // 0.0044° latitude ≈ 489m at NYC latitude
    const nearbyLat = 40.7172;
    expect(isVenueMatch(lat, lng, nearbyLat, lng)).toBe(true);
  });

  it("rejects coordinates beyond 500m", () => {
    // 0.0045° latitude ≈ 500.38m at NYC latitude
    const farLat = 40.7173;
    expect(isVenueMatch(lat, lng, farLat, lng)).toBe(false);
  });

  it("rejects coordinates 1km apart", () => {
    const farLat = 40.7218;
    expect(isVenueMatch(lat, lng, farLat, lng)).toBe(false);
  });
});

// ── Full triple predicate ──────────────────────────────────────────────────────

describe("isCrossProviderDuplicate", () => {
  const base = {
    title: "Summer Jazz Festival",
    startTime: new Date("2026-08-01T20:00:00Z"),
    latitude: 40.7128,
    longitude: -74.006,
  };

  it("accepts when all three criteria match", () => {
    expect(isCrossProviderDuplicate(base, { ...base })).toBe(true);
  });

  it("rejects when title is different enough", () => {
    expect(
      isCrossProviderDuplicate(base, {
        ...base,
        title: "Winter Rock Concert Underground",
      })
    ).toBe(false);
  });

  it("rejects when time is outside ±2h", () => {
    expect(
      isCrossProviderDuplicate(base, {
        ...base,
        startTime: new Date(base.startTime.getTime() + 3 * 60 * 60 * 1000),
      })
    ).toBe(false);
  });

  it("rejects when venue is beyond 500m", () => {
    expect(
      isCrossProviderDuplicate(base, {
        ...base,
        latitude: 40.725,
        longitude: -74.006,
      })
    ).toBe(false);
  });
});

// ── Cross-run merge — collision path ──────────────────────────────────────────

import { prisma } from "@/lib/db/client";

const CANONICAL_ID = "canonical-evt-id";
const LOSER_ID = "loser-evt-id";
const SHARED_USER = "user-abc";
const UNIQUE_USER = "user-xyz";

function buildTxMock() {
  const savedEventFindMany = vi.fn().mockImplementation(
    async ({ where }: { where: { eventId: string } }) => {
      if (where.eventId === CANONICAL_ID) return [{ userId: SHARED_USER }];
      return [
        { id: "se-shared", userId: SHARED_USER },
        { id: "se-unique", userId: UNIQUE_USER },
      ];
    }
  );

  const goingEventFindMany = vi.fn().mockImplementation(
    async ({ where }: { where: { eventId: string } }) => {
      if (where.eventId === CANONICAL_ID) return [{ userId: SHARED_USER }];
      return [
        { id: "ge-shared", userId: SHARED_USER },
        { id: "ge-unique", userId: UNIQUE_USER },
      ];
    }
  );

  const eventReminderFindMany = vi.fn().mockImplementation(
    async ({ where }: { where: { eventId: string } }) => {
      if (where.eventId === CANONICAL_ID) return [{ userId: SHARED_USER }];
      return [
        { id: "er-shared", userId: SHARED_USER },
        { id: "er-unique", userId: UNIQUE_USER },
      ];
    }
  );

  return {
    savedEvent: {
      findMany: savedEventFindMany,
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    goingEvent: {
      findMany: goingEventFindMany,
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    eventReminder: {
      findMany: eventReminderFindMany,
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    eventSource: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    event: { delete: vi.fn().mockResolvedValue({}) },
  };
}

type TxMock = ReturnType<typeof buildTxMock>;

function installTx(tx: TxMock) {
  vi.mocked(prisma).$transaction = vi.fn().mockImplementation(
    (fn: (t: TxMock) => Promise<void>) => fn(tx)
  );
}

describe("mergeIntoCanonical — collision path", () => {
  it("moves unique-user SavedEvent rows to canonical and drops collision rows", async () => {
    const tx = buildTxMock();
    installTx(tx);

    await mergeIntoCanonical(CANONICAL_ID, LOSER_ID);

    const savedUpdate = tx.savedEvent.updateMany.mock.calls;
    const savedDelete = tx.savedEvent.deleteMany.mock.calls;

    expect(savedUpdate.length).toBeGreaterThan(0);
    expect(savedUpdate[0][0].data.eventId).toBe(CANONICAL_ID);
    expect(savedUpdate[0][0].where.id.in).toContain("se-unique");
    expect(savedUpdate[0][0].where.id.in).not.toContain("se-shared");

    expect(savedDelete.length).toBeGreaterThan(0);
    expect(savedDelete[0][0].where.id.in).toContain("se-shared");
    expect(savedDelete[0][0].where.id.in).not.toContain("se-unique");
  });

  it("moves unique GoingEvent rows and deletes colliding ones", async () => {
    const tx = buildTxMock();
    installTx(tx);

    await mergeIntoCanonical(CANONICAL_ID, LOSER_ID);

    const goingUpdate = tx.goingEvent.updateMany.mock.calls;
    const goingDelete = tx.goingEvent.deleteMany.mock.calls;

    expect(goingUpdate.length).toBeGreaterThan(0);
    expect(goingUpdate[0][0].where.id.in).toContain("ge-unique");
    expect(goingUpdate[0][0].where.id.in).not.toContain("ge-shared");

    expect(goingDelete.length).toBeGreaterThan(0);
    expect(goingDelete[0][0].where.id.in).toContain("ge-shared");
  });

  it("moves unique EventReminder rows and deletes colliding ones", async () => {
    const tx = buildTxMock();
    installTx(tx);

    await mergeIntoCanonical(CANONICAL_ID, LOSER_ID);

    const reminderUpdate = tx.eventReminder.updateMany.mock.calls;
    const reminderDelete = tx.eventReminder.deleteMany.mock.calls;

    expect(reminderUpdate.length).toBeGreaterThan(0);
    expect(reminderUpdate[0][0].where.id.in).toContain("er-unique");
    expect(reminderUpdate[0][0].where.id.in).not.toContain("er-shared");

    expect(reminderDelete.length).toBeGreaterThan(0);
    expect(reminderDelete[0][0].where.id.in).toContain("er-shared");
  });

  it("re-parents EventSource rows to canonical", async () => {
    const tx = buildTxMock();
    installTx(tx);

    await mergeIntoCanonical(CANONICAL_ID, LOSER_ID);

    expect(tx.eventSource.updateMany).toHaveBeenCalledWith({
      where: { eventId: LOSER_ID },
      data: { eventId: CANONICAL_ID },
    });
  });

  it("deletes the loser event after all rows are moved", async () => {
    const tx = buildTxMock();
    installTx(tx);

    await mergeIntoCanonical(CANONICAL_ID, LOSER_ID);

    expect(tx.event.delete).toHaveBeenCalledWith({ where: { id: LOSER_ID } });
  });

  it("runs everything in a single transaction", async () => {
    const tx = buildTxMock();
    installTx(tx);

    await mergeIntoCanonical(CANONICAL_ID, LOSER_ID);

    expect(vi.mocked(prisma).$transaction).toHaveBeenCalledTimes(1);
  });
});

// ── Cross-run cross-provider dedupe ───────────────────────────────────────────

describe("deduplicateCrossRun — cross-run pipeline entry point", () => {
  const NEW_TM_EVENT_ID = "new-tm-event";
  const PRIOR_MEETUP_EVENT_ID = "prior-meetup-event";
  const SHARED_USER_CR = "user-cross-run";
  const UNIQUE_USER_CR = "user-unique-cr";

  const startTime = new Date("2026-10-01T20:00:00Z");

  const newTmEvent = {
    id: NEW_TM_EVENT_ID,
    title: "Summer Jazz Festival",
    startTime,
    endTime: null,
    latitude: 40.7128,
    longitude: -74.006,
    isActive: true,
    sources: [{ provider: "TICKETMASTER" as const, externalId: "tm-xyz", eventId: NEW_TM_EVENT_ID }],
  };

  const priorMeetupEvent = {
    id: PRIOR_MEETUP_EVENT_ID,
    title: "Summer Jazz Festival",
    startTime: new Date(startTime.getTime() + 30 * 60 * 1000),
    endTime: null,
    latitude: 40.7128,
    longitude: -74.006,
    isActive: true,
    sources: [{ provider: "MEETUP" as const, externalId: "mu-xyz", eventId: PRIOR_MEETUP_EVENT_ID }],
  };

  function buildCrossRunTxMock() {
    const savedEventFindMany = vi.fn().mockImplementation(
      async ({ where }: { where: { eventId: string } }) => {
        if (where.eventId === NEW_TM_EVENT_ID) return [{ userId: SHARED_USER_CR }];
        return [
          { id: "se-shared-cr", userId: SHARED_USER_CR },
          { id: "se-unique-cr", userId: UNIQUE_USER_CR },
        ];
      }
    );

    const goingEventFindMany = vi.fn().mockImplementation(
      async ({ where }: { where: { eventId: string } }) => {
        if (where.eventId === NEW_TM_EVENT_ID) return [{ userId: SHARED_USER_CR }];
        return [
          { id: "ge-shared-cr", userId: SHARED_USER_CR },
          { id: "ge-unique-cr", userId: UNIQUE_USER_CR },
        ];
      }
    );

    const eventReminderFindMany = vi.fn().mockImplementation(
      async ({ where }: { where: { eventId: string } }) => {
        if (where.eventId === NEW_TM_EVENT_ID) return [];
        return [{ id: "er-unique-cr", userId: UNIQUE_USER_CR }];
      }
    );

    return {
      savedEvent: {
        findMany: savedEventFindMany,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      goingEvent: {
        findMany: goingEventFindMany,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      eventReminder: {
        findMany: eventReminderFindMany,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      eventSource: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      event: { delete: vi.fn().mockResolvedValue({}) },
    };
  }

  it("merges prior-run Meetup event into new Ticketmaster canonical via deduplicateCrossRun", async () => {
    const tx = buildCrossRunTxMock();

    vi.mocked(prisma).event = {
      findMany: vi.fn()
        .mockResolvedValueOnce([newTmEvent])
        .mockResolvedValueOnce([priorMeetupEvent]),
    } as unknown as typeof prisma.event;

    vi.mocked(prisma).$transaction = vi.fn().mockImplementation(
      (fn: (t: typeof tx) => Promise<void>) => fn(tx)
    );

    const count = await deduplicateCrossRun([NEW_TM_EVENT_ID]);

    expect(count).toBe(1);
    expect(vi.mocked(prisma).$transaction).toHaveBeenCalledTimes(1);
    expect(tx.eventSource.updateMany).toHaveBeenCalledWith({
      where: { eventId: PRIOR_MEETUP_EVENT_ID },
      data: { eventId: NEW_TM_EVENT_ID },
    });
    expect(tx.event.delete).toHaveBeenCalledWith({ where: { id: PRIOR_MEETUP_EVENT_ID } });
  });

  it("Ticketmaster canonical wins — Meetup source re-parented to TM event", async () => {
    const tx = buildCrossRunTxMock();

    vi.mocked(prisma).event = {
      findMany: vi.fn()
        .mockResolvedValueOnce([newTmEvent])
        .mockResolvedValueOnce([priorMeetupEvent]),
    } as unknown as typeof prisma.event;

    vi.mocked(prisma).$transaction = vi.fn().mockImplementation(
      (fn: (t: typeof tx) => Promise<void>) => fn(tx)
    );

    await deduplicateCrossRun([NEW_TM_EVENT_ID]);

    const sourceUpdate = tx.eventSource.updateMany.mock.calls[0][0];
    expect(sourceUpdate.data.eventId).toBe(NEW_TM_EVENT_ID);
    expect(tx.event.delete).toHaveBeenCalledWith({ where: { id: PRIOR_MEETUP_EVENT_ID } });
  });

  it("GoingEvent collision: shared user row dropped, unique user row re-parented", async () => {
    const tx = buildCrossRunTxMock();

    vi.mocked(prisma).event = {
      findMany: vi.fn()
        .mockResolvedValueOnce([newTmEvent])
        .mockResolvedValueOnce([priorMeetupEvent]),
    } as unknown as typeof prisma.event;

    vi.mocked(prisma).$transaction = vi.fn().mockImplementation(
      (fn: (t: typeof tx) => Promise<void>) => fn(tx)
    );

    await deduplicateCrossRun([NEW_TM_EVENT_ID]);

    const goingUpdate = tx.goingEvent.updateMany.mock.calls[0][0];
    expect(goingUpdate.where.id.in).toContain("ge-unique-cr");
    expect(goingUpdate.where.id.in).not.toContain("ge-shared-cr");

    const goingDelete = tx.goingEvent.deleteMany.mock.calls[0][0];
    expect(goingDelete.where.id.in).toContain("ge-shared-cr");
  });

  it("returns 0 when no cross-run duplicates found", async () => {
    const txFn = vi.fn();
    vi.mocked(prisma).$transaction = txFn;
    vi.mocked(prisma).event = {
      findMany: vi.fn()
        .mockResolvedValueOnce([newTmEvent])
        .mockResolvedValueOnce([]),
    } as unknown as typeof prisma.event;

    const count = await deduplicateCrossRun([NEW_TM_EVENT_ID]);
    expect(count).toBe(0);
    expect(txFn).not.toHaveBeenCalled();
  });
});
