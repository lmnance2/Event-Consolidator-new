"use client"

import { useState, useCallback } from "react"
import { Users } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

interface Friend {
  id: string
  name: string | null
  image: string | null
  friendsSince: string
}

interface FriendsTabProps {
  initialFriends: Friend[]
}

function formatMonthYear(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoString))
}

export function FriendsTab({ initialFriends }: FriendsTabProps) {
  const router = useRouter()
  const [friends, setFriends] = useState<Friend[]>(initialFriends)
  const [unfriending, setUnfriending] = useState<Friend | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemove = useCallback(async () => {
    if (!unfriending) return
    setIsRemoving(true)
    try {
      const res = await fetch(`/api/friends/${unfriending.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setFriends((prev) => prev.filter((f) => f.id !== unfriending.id))
        setUnfriending(null)
        router.refresh()
      }
    } finally {
      setIsRemoving(false)
    }
  }, [unfriending, router])

  if (friends.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-base">
          Discover events with{" "}
          <span className="font-serif italic text-foreground">your</span> people.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a friend request to see what they are going to.
        </p>
        <Link href="/friends?tab=add" className={cn(buttonVariants({ variant: "brand", size: "sm" }), "mt-5")}>
          Add a friend
        </Link>
      </div>
    )
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {friends.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-4 py-4 transition-colors duration-150 hover:bg-muted/40 -mx-1 px-1 rounded-md"
          >
            <Avatar user={f} size={40} alt={f.name ?? ""} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.name ?? "Unnamed friend"}</p>
              <p className="truncate text-xs text-muted-foreground">
                Friends since {formatMonthYear(f.friendsSince)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUnfriending(f)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={unfriending !== null} onOpenChange={(open) => { if (!open) setUnfriending(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove {unfriending?.name ?? "friend"}?</DialogTitle>
            <DialogDescription>
              You will no longer see each other&apos;s Going events. You can send a new friend request anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setUnfriending(null)}
              disabled={isRemoving}
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isRemoving}
              className="inline-flex items-center justify-center rounded-lg px-3 h-7 text-[0.8rem] font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
