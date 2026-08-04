"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Lock, AlertTriangle, CircleCheck } from "lucide-react";
import { PasswordField } from "@/components/auth/password-field";
import { Field } from "@/components/auth/field";
import { FormError } from "@/components/auth/form-error";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match.",
    path: ["confirm"],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordFormInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  if (!token) {
    return (
      <div className="w-full max-w-md">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto size-12 rounded-2xl bg-destructive/10 grid place-items-center mb-4">
              <AlertTriangle className="size-6 text-destructive" aria-hidden />
            </div>
            <CardTitle className="text-2xl tracking-tight">
              Invalid reset link
            </CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired. Request a new
              one from the login page.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/login" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to login
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-md">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto size-12 rounded-2xl bg-emerald-500/10 grid place-items-center mb-4">
              <CircleCheck className="size-6 text-emerald-600" aria-hidden />
            </div>
            <CardTitle className="text-2xl tracking-tight">
              Password updated
            </CardTitle>
            <CardDescription>
              Your password has been updated. Sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/login" className={cn(buttonVariants({ variant: "brand" }))}>
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setTokenError(false);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: values.password }),
      });

      if (res.status === 400) {
        setTokenError(true);
        return;
      }

      if (!res.ok) {
        setFormError("Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setFormError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="w-full max-w-md">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto size-12 rounded-2xl bg-brand-soft grid place-items-center mb-4">
            <Lock className="size-6 text-brand" aria-hidden />
          </div>
          <CardTitle className="text-2xl tracking-tight">
            Set a new password
          </CardTitle>
          <CardDescription>
            Choose a strong password with at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            id="auth-primary"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
            tabIndex={-1}
          >
            <PasswordField
              label="New password"
              autoComplete="new-password"
              error={errors.password?.message}
              helper="8+ characters. 12+ is stronger."
              {...register("password")}
            />

            <Field
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              error={errors.confirm?.message}
              {...register("confirm")}
            />

            {tokenError ? (
              <p className="text-xs text-destructive" role="alert">
                This reset link is invalid or has expired.{" "}
                <Link
                  href="/forgot-password"
                  className="underline underline-offset-2"
                >
                  Request a new one.
                </Link>
              </p>
            ) : (
              <FormError message={formError} />
            )}

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}
