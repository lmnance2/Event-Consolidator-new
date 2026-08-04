import { redirect } from "next/navigation";
import { type Metadata } from "next";
import { z } from "zod";
import { Category, ExperienceType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { isPro } from "@/lib/subscription/is-pro";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { AccountSection } from "@/components/settings/account-section";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    include: { preferences: true, subscription: true },
  });

  const proUser = isPro(user.subscription);

  const prefs = user.preferences;

  // Prisma Json is untyped — validate at the boundary
  const categoryParseResult = z
    .array(z.enum(Object.values(Category) as [Category, ...Category[]]))
    .safeParse(prefs?.disabledCategories);
  if (!categoryParseResult.success) {
    console.error("[settings] Invalid disabledCategories JSON for user", {
      userId: session.user.id,
      raw: prefs?.disabledCategories,
    });
  }
  const disabledCategories = categoryParseResult.success
    ? categoryParseResult.data
    : [];

  const prefsInitial = {
    disabledCategories,
    maxDistanceMiles: prefs?.maxDistanceMiles ?? 25,
    dateRangeDays: prefs?.dateRangeDays ?? 30,
    priceMin: prefs?.priceMin ?? null,
    priceMax: prefs?.priceMax ?? null,
    experienceType: prefs?.experienceType ?? ExperienceType.BOTH,
    familyFriendly: prefs?.familyFriendly ?? false,
  };

  const accountInitial = {
    email: user.email,
    name: user.name,
    zipCode: user.zipCode,
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 md:py-16 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
        Settings
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Preferences</CardTitle>
          <CardDescription>
            Defaults for your feed. Change anytime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm initial={prefsInitial} isPro={proUser} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <AccountSection initial={accountInitial} />
        </CardContent>
      </Card>
    </section>
  );
}
