"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Category } from "@prisma/client";
import {
  preferencesPartialSchema,
  type PreferencesPartialInput,
  PRO_ONLY_FIELDS,
  CATEGORY_DISPLAY_ORDER,
} from "@/lib/preferences/schema";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/auth/field";
import { FormError } from "@/components/auth/form-error";
import { ProLockBadge } from "@/components/settings/pro-lock-badge";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<Category, string> = {
  MUSIC: "Music",
  SPORTS: "Sports",
  ARTS_THEATER: "Arts & Theater",
  FOOD_DRINK: "Food & Drink",
  NETWORKING: "Networking",
  HEALTH_WELLNESS: "Health & Wellness",
  OUTDOOR_ADVENTURE: "Outdoor & Adventure",
  FAMILY_FRIENDLY: "Family Friendly",
  COMMUNITY_CULTURE: "Community & Culture",
  NIGHTLIFE: "Nightlife",
  EDUCATION: "Education",
  OTHER: "Other",
};

interface PreferencesFormProps {
  initial: {
    disabledCategories: Category[];
    maxDistanceMiles: number;
    dateRangeDays: number;
    priceMin: number | null;
    priceMax: number | null;
    experienceType: "INDOOR" | "OUTDOOR" | "BOTH";
    familyFriendly: boolean;
  };
  isPro: boolean;
}

export function PreferencesForm({ initial, isPro }: PreferencesFormProps) {
  const [successVisible, setSuccessVisible] = React.useState(false);
  const successTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PreferencesPartialInput>({
    resolver: zodResolver(preferencesPartialSchema),
    defaultValues: {
      disabledCategories: initial.disabledCategories,
      maxDistanceMiles: initial.maxDistanceMiles,
      dateRangeDays: initial.dateRangeDays,
      priceMin: initial.priceMin ?? undefined,
      priceMax: initial.priceMax ?? undefined,
      experienceType: initial.experienceType,
      familyFriendly: initial.familyFriendly,
    },
  });

  const disabledCategories = watch("disabledCategories") ?? [];

  function toggleCategory(cat: Category) {
    const current = disabledCategories;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setValue("disabledCategories", next, { shouldDirty: true });
  }

  async function onSubmit(data: PreferencesPartialInput) {
    setSuccessVisible(false);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);

    const body: PreferencesPartialInput = { ...data };
    if (!isPro) {
      PRO_ONLY_FIELDS.forEach((field) => {
        delete (body as Partial<typeof body>)[field];
      });
    }

    try {
      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError("root", {
          message: json.error ?? "Couldn't save. Please try again.",
        });
        return;
      }

      setSuccessVisible(true);
      successTimerRef.current = setTimeout(() => setSuccessVisible(false), 3000);
    } catch {
      setError("root", { message: "Couldn't save. Please try again." });
    }
  }

  const isProField = (field: string) =>
    (PRO_ONLY_FIELDS as readonly string[]).includes(field);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Categories</Label>
        <p className="text-xs text-muted-foreground">
          Selected categories appear in your feed.
        </p>
        <div
          className="grid grid-cols-2 gap-2 md:grid-cols-3"
          role="group"
          aria-label="Feed categories"
        >
          {CATEGORY_DISPLAY_ORDER.map((cat) => {
            const isSelected = !disabledCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium transition-all duration-150 text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  isSelected
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border bg-background text-foreground hover:border-foreground/30"
                )}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      <Field
        label="Max distance (miles)"
        type="number"
        inputMode="numeric"
        min={1}
        max={500}
        error={errors.maxDistanceMiles?.message}
        {...register("maxDistanceMiles", { valueAsNumber: true })}
      />

      <Field
        label="Date range (days)"
        type="number"
        inputMode="numeric"
        min={1}
        max={365}
        error={errors.dateRangeDays?.message}
        {...register("dateRangeDays", { valueAsNumber: true })}
      />

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Min price ($)"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Any"
          error={errors.priceMin?.message}
          {...register("priceMin", {
            setValueAs: (v: string) => (v === "" ? null : Number(v)),
          })}
        />
        <Field
          label="Max price ($)"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Any"
          error={errors.priceMax?.message}
          {...register("priceMax", {
            setValueAs: (v: string) => (v === "" ? null : Number(v)),
          })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="experienceType"
            className={cn(!isPro && "text-muted-foreground")}
          >
            Experience type
          </Label>
          {isProField("experienceType") && !isPro && <ProLockBadge />}
        </div>
        <Controller
          control={control}
          name="experienceType"
          render={({ field }) => (
            <div
              role="radiogroup"
              aria-label="Experience type"
              className="flex gap-2"
            >
              {(["INDOOR", "OUTDOOR", "BOTH"] as const).map((option) => {
                const labels = {
                  INDOOR: "Indoor",
                  OUTDOOR: "Outdoor",
                  BOTH: "Both",
                };
                const isChecked = field.value === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={isChecked}
                    disabled={!isPro}
                    aria-disabled={!isPro}
                    onClick={() => field.onChange(option)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-all duration-150",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      "disabled:pointer-events-none disabled:opacity-50",
                      isChecked
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-border bg-background text-foreground hover:border-foreground/30"
                    )}
                  >
                    {labels[option]}
                  </button>
                );
              })}
            </div>
          )}
        />
        {errors.experienceType && (
          <p className="text-xs text-destructive">
            {errors.experienceType.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="familyFriendly"
            className={cn(!isPro && "text-muted-foreground")}
          >
            Family friendly only
          </Label>
          {isProField("familyFriendly") && !isPro && <ProLockBadge />}
        </div>
        <Controller
          control={control}
          name="familyFriendly"
          render={({ field }) => (
            <Switch
              id="familyFriendly"
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={!isPro}
              aria-disabled={!isPro}
            />
          )}
        />
      </div>

      {errors.root && <FormError message={errors.root.message} />}

      {successVisible && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
        >
          Preferences saved.
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="brand" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}
