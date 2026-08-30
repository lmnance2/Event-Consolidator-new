"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

interface Friend {
  id: string
  name: string | null
  image: string | null
}

interface InviteFriendsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  eventTitle: string
}

export function InviteFriendsDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
}: InviteFriendsDialogProps) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSending, setIsSending] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set())
      setToastMessage(null)
      return
    }
    setIsLoading(true)
    fetch("/api/friends")
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as Friend[]
        setFriends(data)
      })
      .finally(() => setIsLoading(false))
  }, [open])

  const toggleFriend = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSend = useCallback(async () => {
    if (selectedIds.size === 0) return
    setIsSending(true)
    setToastMessage(null)
    try {
      const res = await fetch(`/api/events/${eventId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendIds: Array.from(selectedIds) }),
      })
      if (res.status === 429) {
        setToastMessage("You are inviting a lot of people right now. Try again in a bit.")
        return
      }
      if (!res.ok) {
        setToastMessage("Something went wrong. Try again.")
        return
      }
      const data = (await res.json()) as {
        sent: number
        droppedNonFriend: number
        droppedEmailFailure: number
      }
      if (data.sent === 0 && data.droppedEmailFailure > 0) {
        setToastMessage("Couldn't send invites. Try again.")
        return
      }
      const msg =
        data.droppedNonFriend === 0
          ? `Invites sent to ${data.sent} friend${data.sent === 1 ? "" : "s"}.`
          : `Sent to ${data.sent} of ${data.sent + data.droppedNonFriend} friends.`
      setToastMessage(msg)
      setSelectedIds(new Set())
      setTimeout(() => {
        onOpenChange(false)
      }, 2000)
    } finally {
      setIsSending(false)
    }
  }, [selectedIds, eventId, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite friends to {eventTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : friends.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">
              You need friends to invite.{" "}
              <Link href="/friends?tab=add" className="text-brand hover:underline" onClick={() => onOpenChange(false)}>
                Add friends first
              </Link>
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </p>
            <ul className="max-h-80 overflow-y-auto space-y-1 -mx-1">
              {friends.map((f) => (
                <li key={f.id}>
                  <label className="flex items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-muted transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.id)}
                      onChange={() => toggleFriend(f.id)}
                      className="h-4 w-4 rounded border-border accent-brand"
                    />
                    <Avatar user={f} size={32} alt={f.name ?? ""} />
                    <span className="text-sm font-medium truncate">{f.name ?? "Unnamed friend"}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        {toastMessage && (
          <p className="text-sm text-muted-foreground text-center py-1">{toastMessage}</p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button
            variant="brand"
            onClick={handleSend}
            disabled={selectedIds.size === 0 || isSending || friends.length === 0}
          >
            {isSending ? "Sending..." : "Send invites"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
