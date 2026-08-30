"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

type FormValues = z.infer<typeof schema>

export function AddTab() {
  const [successVisible, setSuccessVisible] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!successVisible) return
    const timer = setTimeout(() => setSuccessVisible(false), 6000)
    return () => clearTimeout(timer)
  }, [successVisible])

  const onSubmit = async (values: FormValues) => {
    setErrorMessage(null)
    setSuccessVisible(false)
    try {
      const res = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      })
      if (res.ok || res.status === 429) {
        reset()
        setSuccessVisible(true)
      } else {
        setErrorMessage("Something went wrong. Try again.")
      }
    } catch {
      setErrorMessage("Something went wrong. Try again.")
    }
  }

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold">Send a friend request</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your friend&apos;s Event Atlas email address.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="friend-email">Email</Label>
          <Input
            id="friend-email"
            type="email"
            autoComplete="email"
            placeholder="friend@example.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          variant="brand"
          disabled={isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Send request"
          )}
        </Button>

        {successVisible && (
          <Alert>
            <AlertDescription>
              Request sent. If they have an account, they&apos;ll see it in their requests.
            </AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  )
}
