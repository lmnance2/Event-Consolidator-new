"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { Field } from "@/components/auth/field";
import { PasswordField } from "@/components/auth/password-field";
import { FormError } from "@/components/auth/form-error";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/feed";
  const authError = searchParams.get("error");
  const accountCreated = searchParams.get("accountCreated") === "1";

  const [formError, setFormError] = useState<string | null>(
    authError ? "Authentication failed. Please try again." : null
  );

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15_000);

      let res: Awaited<ReturnType<typeof signIn>> | undefined;
      try {
        res = await signIn("credentials", {
          email: values.email,
          password: values.password,
          redirect: false,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (controller.signal.aborted) {
        setFormError("The server is taking a while. Please try again.");
        return;
      }

      if (res?.error || !res?.ok) {
        setFormError("Wrong email or password.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setFormError("Something went wrong. Please try again.");
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your Event Atlas account"
      footer={
        <span>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-brand hover:underline">
            Sign up
          </Link>
        </span>
      }
    >
      {accountCreated && (
        <Alert className="bg-emerald-500/10 border-emerald-500/20 text-emerald-700">
          <CheckCircle className="size-4 text-emerald-600" aria-hidden />
          <AlertDescription>
            Account created. Sign in to continue.
          </AlertDescription>
        </Alert>
      )}

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
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <PasswordField
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          rightAdornment={
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </Link>
          }
          {...register("password")}
        />

        <FormError message={formError} />

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}
