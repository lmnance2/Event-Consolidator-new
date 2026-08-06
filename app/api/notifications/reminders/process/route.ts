import * as React from "react";
import * as crypto from "crypto";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { ReminderEmail } from "@/lib/email/templates/reminder";
import { formatFullDate, formatTime } from "@/lib/events/format";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 50;

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function GET(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || !timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = process.env.NEXTAUTH_URL;
  if (!origin) {
    console.error(
      JSON.stringify({
        event: "reminders.config.error",
        error: "NEXTAUTH_URL is not set — aborting batch to prevent broken email links",
      })
    );
    return Response.json(
      { error: "Server misconfiguration: NEXTAUTH_URL not set" },
      { status: 500 }
    );
  }

  const now = new Date();

  // Step 1: find candidate IDs (PENDING, sendAt <= now).
  let candidateIds: string[] = [];
  try {
    const candidates = await prisma.eventReminder.findMany({
      where: {
        status: "PENDING",
        sendAt: { lte: now },
      },
      take: BATCH_SIZE,
      select: { id: true },
      orderBy: { sendAt: "asc" },
    });
    candidateIds = candidates.map((r) => r.id);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "reminders.query.error",
        error: String(err),
      })
    );
    return Response.json({ error: "Failed to query reminders" }, { status: 500 });
  }

  if (candidateIds.length === 0) {
    console.log(
      JSON.stringify({
        event: "reminders.complete",
        claimed: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        at: now.toISOString(),
      })
    );
    return Response.json(
      { processed: 0, sent: 0, failed: 0, cancelled: 0 },
      { status: 200 }
    );
  }

  // Step 2: atomically claim the candidates.
  //
  // Vercel Cron serializes cron invocations per project, so truly concurrent
  // runs of this handler are extremely rare. The serializable transaction +
  // status=PENDING guard in updateMany is belt-and-suspenders: if two workers
  // somehow race, one's updateMany will conflict and throw a serialization
  // error, preventing double-sends. We then return early and let the next
  // 15-min run pick up anything unclaimed.
  //
  // We cannot add a SENDING enum value (schema change is off-scope), so we use
  // FAILED as a claim sentinel: rows are atomically moved PENDING -> FAILED
  // inside the serializable transaction. Processing then corrects them to SENT
  // (or leaves them FAILED if sending genuinely fails). A crash between claim
  // and send leaves rows in FAILED, which is the correct terminal state for an
  // unsent reminder.
  //
  // The status=PENDING guard in updateMany ensures only rows that were still
  // PENDING at claim time are in our working set, even if a concurrent worker
  // raced us on the same candidate IDs.
  let claimedCount = 0;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const { count } = await tx.eventReminder.updateMany({
          where: {
            id: { in: candidateIds },
            status: "PENDING",
          },
          data: { status: "FAILED" },
        });
        return count;
      },
      { isolationLevel: "Serializable" }
    );
    claimedCount = result;
  } catch (err) {
    // Serialization failure: another worker claimed the same rows. Log and
    // return early; the next run will catch any remaining PENDING reminders.
    console.error(
      JSON.stringify({
        event: "reminders.claim.error",
        error: String(err),
      })
    );
    return Response.json({ error: "Claim failed, will retry next run" }, { status: 500 });
  }

  if (claimedCount === 0) {
    console.log(
      JSON.stringify({
        event: "reminders.complete",
        claimed: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
        at: now.toISOString(),
      })
    );
    return Response.json(
      { processed: 0, sent: 0, failed: 0, cancelled: 0 },
      { status: 200 }
    );
  }

  // Step 3: fetch full reminder data (event + user + sources) for the claimed rows.
  // We re-query by candidateIds with status=FAILED to get only what we claimed
  // (candidateIds were all PENDING before the transaction; the FAILED ones in
  // that set are ours).
  //
  // Sources are fetched here alongside the event to avoid N+1 queries — one
  // round-trip covers ticket URLs for the entire batch. The first source by
  // createdAt (ascending) is the primary ticket URL, matching getPrimaryTicketUrl
  // semantics but without the per-reminder DB call.
  const reminders = await prisma.eventReminder.findMany({
    where: {
      id: { in: candidateIds },
      status: "FAILED",
    },
    include: {
      event: {
        include: {
          sources: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { ticketUrl: true },
          },
        },
      },
      user: true,
    },
  });

  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  const results = await Promise.allSettled(
    reminders.map(async (reminder) => {
      const { id: reminderId, event, user } = reminder;

      // Defense in depth: if the event was somehow hard-deleted (GoingEvent
      // Restrict constraint normally blocks this), cancel the reminder and skip.
      if (!event) {
        console.warn(
          JSON.stringify({
            event: "reminders.event_missing",
            reminderId,
            userId: user.id,
          })
        );
        await prisma.eventReminder.update({
          where: { id: reminderId },
          data: { status: "CANCELLED" },
        });
        return "cancelled" as const;
      }

      // Belt-and-suspenders: if the event has already started, cancel rather
      // than send a stale reminder.
      if (event.startTime <= now) {
        await prisma.eventReminder.update({
          where: { id: reminderId },
          data: { status: "CANCELLED" },
        });
        return "cancelled" as const;
      }

      const eventDate = formatFullDate(event.startTime.toISOString());
      const eventTime = formatTime(event.startTime.toISOString());
      const eventUrl = `${origin}/feed?event=${event.id}`;
      const unsubscribeUrl = `${origin}/settings#notifications`;
      const venueName = event.venue ?? "";

      // Ticket URL comes from the batched sources include — no per-reminder query.
      const primaryTicketUrl = event.sources[0]?.ticketUrl ?? null;
      const ticketUrl = primaryTicketUrl ?? eventUrl;

      try {
        await sendEmail({
          to: user.email,
          subject: `Coming up: ${event.title}`,
          react: React.createElement(ReminderEmail, {
            userName: user.name,
            eventTitle: event.title,
            eventDate,
            eventTime,
            venueName,
            eventUrl,
            ticketUrl,
            unsubscribeUrl,
          }),
        });

        await prisma.eventReminder.update({
          where: { id: reminderId },
          data: { status: "SENT" },
        });

        console.log(
          JSON.stringify({
            event: "reminder.sent",
            reminderId,
            userId: user.id,
            eventId: event.id,
            at: new Date().toISOString(),
          })
        );

        return "sent" as const;
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "reminder.send.error",
            reminderId,
            userId: user.id,
            eventId: event.id,
            error: String(err),
          })
        );

        // Row is already in FAILED state (our claim sentinel), so this update
        // is a no-op for the status field but records the failure time via
        // updatedAt.
        await prisma.eventReminder.update({
          where: { id: reminderId },
          data: { status: "FAILED" },
        });

        return "failed" as const;
      }
    })
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value === "sent") sent++;
      else if (result.value === "failed") failed++;
      else if (result.value === "cancelled") cancelled++;
    } else {
      // Unexpected secondary error (e.g. the DB update after send threw).
      failed++;
      console.error(
        JSON.stringify({
          event: "reminders.handler.unexpected_error",
          error: String(result.reason),
        })
      );
    }
  }

  console.log(
    JSON.stringify({
      event: "reminders.complete",
      claimed: claimedCount,
      sent,
      failed,
      cancelled,
      at: new Date().toISOString(),
    })
  );

  return Response.json(
    { processed: claimedCount, sent, failed, cancelled },
    { status: 200 }
  );
}
