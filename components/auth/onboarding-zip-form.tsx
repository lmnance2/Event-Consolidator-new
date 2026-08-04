"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { Field } from "@/components/auth/field";
import { FormError } from "@/components/auth/form-error";

const schema = z.object({
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP"),
});

type FormValues = z.infer<typeof schema>;

export function OnboardingZipForm() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [formError, setFormError] = useState<string | null>(null);

  const firstName = session?.user?.name?.split(" ")[0] ?? null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);

    try {
      const res = await fetch("/api/auth/onboarding/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zipCode: values.zipCode }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      await update();
      router.push("/feed");
    } catch {
      setFormError("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="min-h-svh grid place-items-center px-4">
      <div className="w-full max-w-md">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto size-12 rounded-2xl bg-brand-soft grid place-items-center mb-4">
              <MapPin className="size-6 text-brand" aria-hidden />
            </div>
            <CardTitle className="text-2xl tracking-tight">
              {firstName ? `Welcome, ${firstName}` : "Welcome"}
            </CardTitle>
            <CardDescription>
              Where should we look for events?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <Field
                label="ZIP code"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="e.g. 94102"
                maxLength={10}
                helper="So we can show events near you"
                error={errors.zipCode?.message}
                {...register("zipCode")}
              />

              <FormError message={formError} />

              <Button
                type="submit"
                variant="brand"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Continue to feed"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
