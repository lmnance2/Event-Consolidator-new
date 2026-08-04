"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { KeyRound, Mail } from "lucide-react";
import { Field } from "@/components/auth/field";
import { FormError } from "@/components/auth/form-error";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
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
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      if (res.status === 429) {
        setFormError("Too many attempts. Try again in a minute.");
        return;
      }

      setSubmittedEmail(values.email);
      setSubmitted(true);
    } catch {
      setFormError("Something went wrong. Please try again.");
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-md">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="text-center">
            <div className="mx-auto size-12 rounded-2xl bg-emerald-500/10 grid place-items-center mb-4">
              <Mail className="size-6 text-emerald-600" aria-hidden />
            </div>
            <CardTitle className="text-2xl tracking-tight">
              Check your email
            </CardTitle>
            <CardDescription>
              If an account exists for{" "}
              <span className="font-medium text-foreground">
                {submittedEmail}
              </span>
              , you&apos;ll get a reset link within a minute.
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

  return (
    <div className="w-full max-w-md">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto size-12 rounded-2xl bg-brand-soft grid place-items-center mb-4">
            <KeyRound className="size-6 text-brand" aria-hidden />
          </div>
          <CardTitle className="text-2xl tracking-tight">
            Forgot password
          </CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send a reset link.
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
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <FormError message={formError} />

            <Button
              type="submit"
              variant="brand"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          <Link href="/login" className="text-brand hover:underline">
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
