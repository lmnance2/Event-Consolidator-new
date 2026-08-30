import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { isPro } from "@/lib/subscription/is-pro";
import { orderedPair } from "@/lib/friends/pair";
import { sendEmail } from "@/lib/email/send";
import { EventInviteEmail } from "@/lib/email/templates/event-invite";
import { createEventInviteRateLimiter } from "@/lib/auth/rate-limit";
import * as React from "react";

const ParamSchema = z.object({
  id: z.string().min(1),
});

const BodySchema = z.object({
  friendIds: z.array(z.string().min(1)).max(20),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const senderId = session.user.id;

  // Pro gate: read subscription fresh from DB — never from the session token.
  const subscription = await prisma.subscription.findUnique({
    where: { userId: senderId },
    select: { status: true },
  });
  if (!isPro(subscription)) {
    return Response.json(
      { error: "Pro subscription required", code: "PRO_REQUIRED" },
      { status: 403 }
    );
  }

  // NEXTAUTH_URL pre-flight guard (mirrors reminder-cron pattern).
  const appUrl = process.env.NEXTAUTH_URL;
  if (!appUrl) {
    console.error("[events/[id]/invite POST] NEXTAUTH_URL is not set");
    return Response.json({ error: "Server error" }, { status: 500 });
  }

  const paramParsed = ParamSchema.safeParse(await params);
  if (!paramParsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const bodyParsed = BodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id: eventId } = paramParsed.data;
  const { friendIds } = bodyParsed.data;

  // Rate limit per sender.
  try {
    const limiter = createEventInviteRateLimiter();
    const result = await limiter.limit(senderId);
    if (!result.success) {
      return Response.json(
        { error: "Rate limit exceeded", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }
  } catch (err) {
    console.error("[events/[id]/invite POST] rate-limit error", err);
    // Allow through on Redis failure.
  }

  try {
    // Event must exist and be active.
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        startTime: true,
        venue: true,
        isActive: true,
      },
    });

    if (!event || !event.isActive) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    });

    // Filter out non-friends with a single query (anti-enumeration: caller can't infer friendship state).
    const friendPairs = friendIds.map((fid) => {
      const [a, b] = orderedPair(senderId, fid);
      return { userAId: a, userBId: b };
    });
    const confirmedFriendships = await prisma.friendship.findMany({
      where: { OR: friendPairs },
      select: { userAId: true, userBId: true },
    });
    const mutualFriendSet = new Set(
      confirmedFriendships.map((f) =>
        f.userAId === senderId ? f.userBId : f.userAId
      )
    );

    const eligible = friendIds.filter((fid) => mutualFriendSet.has(fid));
    const droppedNonFriend = friendIds.length - eligible.length;

    if (eligible.length === 0) {
      return Response.json({ sent: 0, droppedNonFriend, droppedEmailFailure: 0 });
    }

    // Fetch eligible recipients.
    const recipients = await prisma.user.findMany({
      where: { id: { in: eligible } },
      select: { id: true, email: true, name: true },
    });

    const eventDate = event.startTime.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
    const eventTime = event.startTime.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    });
    const eventUrl = `${appUrl}/e/${eventId}`;

    // Send one email per recipient; collect results individually so one failure
    // doesn't block the rest.
    let sent = 0;
    let droppedEmailFailure = 0;
    await Promise.allSettled(
      recipients.map(async (recipient) => {
        try {
          await sendEmail({
            to: recipient.email,
            subject: `${sender?.name ?? "Someone"} invited you to ${event.title}`,
            react: React.createElement(EventInviteEmail, {
              fromName: sender?.name ?? null,
              eventTitle: event.title,
              eventDate,
              eventTime,
              venueName: event.venue ?? "TBD",
              eventUrl,
            }),
          });
          sent++;
        } catch (emailErr) {
          console.error(
            `[events/[id]/invite POST] email send failed for recipient ${recipient.id}`,
            emailErr
          );
          droppedEmailFailure++;
        }
      })
    );

    return Response.json({ sent, droppedNonFriend, droppedEmailFailure });
  } catch (err) {
    console.error("[events/[id]/invite POST]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}
