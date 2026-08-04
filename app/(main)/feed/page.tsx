import { Suspense } from "react";
import { redirect } from "next/navigation";
import { type Metadata } from "next";
import { z } from "zod";
import { Category, ExperienceType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { isPro } from "@/lib/subscription/is-pro";
import { getFeedPage } from "@/lib/events/feed-query";
import { SearchAndFilterBar } from "@/components/feed/search-and-filter-bar";
import { EventGrid } from "@/components/feed/event-grid";
import { parseFilterParams } from "@/lib/filters/url-params";
import { UserPreferencesDefaults } from "@/lib/filters/defaults";

export const metadata: Metadata = {
  title: "Feed",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

export default async function FeedPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      latitude: true,
      longitude: true,
      preferences: {
        select: {
          disabledCategories: true,
          maxDistanceMiles: true,
          dateRangeDays: true,
          priceMin: true,
          priceMax: true,
          experienceType: true,
          familyFriendly: true,
        },
      },
      subscription: { select: { status: true } },
    },
  });

  if (!user) redirect("/login");

  if (user.latitude == null || user.longitude == null) {
    redirect("/onboarding/zip");
  }

  const userLat = user.latitude;
  const userLng = user.longitude;

  const prefs = user.preferences;

  const categoryParseResult = z
    .array(z.enum(Object.values(Category) as [Category, ...Category[]]))
    .safeParse(prefs?.disabledCategories);
  const disabledCategories = categoryParseResult.success ? categoryParseResult.data : [];

  const userPreferences: UserPreferencesDefaults = {
    disabledCategories,
    maxDistanceMiles: prefs?.maxDistanceMiles ?? 25,
    dateRangeDays: prefs?.dateRangeDays ?? 30,
    priceMin: prefs?.priceMin ?? null,
    priceMax: prefs?.priceMax ?? null,
    experienceType: (prefs?.experienceType ?? ExperienceType.BOTH) as ExperienceType,
    familyFriendly: prefs?.familyFriendly ?? false,
  };

  const userIsPro = isPro(user.subscription);

  const resolvedSearchParams = await searchParams;
  const rawParams = Object.fromEntries(
    Object.entries(resolvedSearchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v])
  );
  const urlSearchParams = new URLSearchParams(rawParams);
  const overrides = parseFilterParams(urlSearchParams);

  const allCategories = Object.values(Category) as Category[];
  const enabledCategories = overrides.categories
    ?? allCategories.filter((c) => !disabledCategories.includes(c));

  let initialRows: Awaited<ReturnType<typeof getFeedPage>>["rows"] = [];
  let initialNextCursor: string | null = null;
  let ssrFailed = false;

  try {
    const page = await getFeedPage({
      userId: session.user.id,
      userPreferences,
      isPro: userIsPro,
      origin: { lat: userLat, lng: userLng },
      filters: {
        q: overrides.q,
        categories: enabledCategories,
        distanceMi: overrides.distanceMi ?? userPreferences.maxDistanceMiles,
        dateRangeDays: overrides.dateRangeDays ?? userPreferences.dateRangeDays,
        priceMin: overrides.priceMin !== undefined ? overrides.priceMin : userPreferences.priceMin,
        priceMax: overrides.priceMax !== undefined ? overrides.priceMax : userPreferences.priceMax,
        experienceType: userIsPro ? (overrides.experienceType ?? userPreferences.experienceType) : undefined,
        familyFriendly: userIsPro ? (overrides.familyFriendly ?? userPreferences.familyFriendly) : undefined,
        freeOnly: userIsPro ? overrides.freeOnly : undefined,
        timeOfDay: userIsPro ? overrides.timeOfDay : undefined,
        venue: userIsPro ? overrides.venue : undefined,
      },
      cursor: null,
      limit: 20,
    });

    initialRows = page.rows;
    initialNextCursor = page.nextCursor;
  } catch (err) {
    console.error("[feed] SSR getFeedPage failed:", err);
    ssrFailed = true;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 pt-6 md:pt-8 pb-24">
      <h1 className="sr-only">Discover events</h1>
      <Suspense>
        <SearchAndFilterBar prefs={userPreferences} isPro={userIsPro} />
      </Suspense>
      {ssrFailed && (
        <div className="mt-6 rounded-md border border-border bg-muted px-4 py-3 flex items-center justify-between text-sm">
          <span>We couldn&apos;t load the feed. Try refreshing.</span>
        </div>
      )}
      <div className="mt-6">
        <Suspense>
          <EventGrid
            initialRows={initialRows}
            initialNextCursor={initialNextCursor}
            ssrFailed={ssrFailed}
            userLat={userLat}
            userLng={userLng}
          />
        </Suspense>
      </div>
    </div>
  );
}
