"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { Field } from "@/components/auth/field";
import { PasswordField } from "@/components/auth/password-field";
import { FormError } from "@/components/auth/form-error";

const schema = z.object({
  name: z.string().min(1, "Enter your name").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP"),
});

type FormValues = z.infer<typeof schema>;

function SignupFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/feed";
  const [formError, setFormError] = useState<string | null>(null);

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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 429) {
        setFormError("Too many attempts. Try again in a minute.");
        return;
      }

      if (res.status === 400) {
        const data = (await res.json()) as { error?: string };
        setFormError(data.error ?? "Please check your details and try again.");
        return;
      }

      if (!res.ok) {
        setFormError("Something went wrong. Please try again.");
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      let signInRes: Awaited<ReturnType<typeof signIn>> | undefined;
      try {
        signInRes = await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (controller.signal.aborted) {
        router.push("/login?accountCreated=1");
        return;
      }

      if (signInRes?.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        router.push("/login?accountCreated=1");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        setFormError("The server is taking a while. Please try again.");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <AuthCard
      title="Create account"
      description="Join Event Atlas and find events near you"
      footer={
        <span>
          Already have an account?{" "}
          <Link href="/login" className="text-brand hover:underline">
            Log in
          </Link>
        </span>
      }
    >
      <GoogleButton
        onClick={() => signIn("google", { callbackUrl })}
        disabled={isSubmitting}
      />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          or
        </span>
        <Separator className="flex-1" />
      </div>

      <form
        id="auth-primary"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
        tabIndex={-1}
      >
        <Field
          label="Name"
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />

        <Field
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <PasswordField
          label="Password"
          autoComplete="new-password"
          error={errors.password?.message}
          helper="8+ characters. 12+ is stronger."
          {...register("password")}
        />

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
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}

export function SignupForm() {
  return (
    <Suspense fallback={null}>
      <SignupFormInner />
    </Suspense>
  );
}
