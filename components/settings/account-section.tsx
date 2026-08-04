"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Field } from "@/components/auth/field";
import { FormError } from "@/components/auth/form-error";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const accountSchema = z.object({
  name: z.string().min(1, "Enter your name").max(80),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP"),
});

type AccountInput = z.infer<typeof accountSchema>;

interface AccountSectionProps {
  initial: {
    email: string;
    name: string | null;
    zipCode: string | null;
  };
}

export function AccountSection({ initial }: AccountSectionProps) {
  const { update } = useSession();
  const [successVisible, setSuccessVisible] = React.useState(false);
  const successTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountInput>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: initial.name ?? "",
      zipCode: initial.zipCode ?? "",
    },
  });

  async function onSubmit(data: AccountInput) {
    setSuccessVisible(false);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);

    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name, zipCode: data.zipCode }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError("root", {
          message: json.error ?? "Couldn't save. Please try again.",
        });
        return;
      }

      await update();
      setSuccessVisible(true);
      successTimerRef.current = setTimeout(() => setSuccessVisible(false), 3000);
    } catch {
      setError("root", { message: "Couldn't save. Please try again." });
    }
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/users/me", { method: "DELETE" });
      if (res.status === 204 || res.ok) {
        await signOut({ callbackUrl: "/" });
        return;
      }
      const json = (await res.json()) as { error?: string };
      setDeleteError(json.error ?? "Couldn't delete account. Please try again.");
    } catch {
      setDeleteError("Couldn't delete account. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground mb-1 font-medium">Email</p>
        <p className="text-sm text-foreground">{initial.email}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field
          label="Name"
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />
        <Field
          label="ZIP code"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="e.g. 94102"
          maxLength={10}
          error={errors.zipCode?.message}
          {...register("zipCode")}
        />

        {errors.root && <FormError message={errors.root.message} />}

        {successVisible && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
          >
            Changes saved.
          </div>
        )}

        <Button type="submit" variant="brand" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
      </form>

      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={() => signOut({ callbackUrl: "/" })}
          type="button"
        >
          Sign out
        </Button>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-destructive hover:text-destructive hover:bg-destructive/10"
            )}
            aria-label="Delete account"
          >
            Delete account
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Delete account?</DialogTitle>
              <DialogDescription>
                This permanently removes your account, saved events, Going
                events, friends, and reminders. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deleteError && <FormError message={deleteError} />}
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                type="button"
                disabled={deleteLoading}
                aria-label="Delete my account"
                onClick={handleDeleteAccount}
              >
                {deleteLoading ? "Deleting…" : "Delete my account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
