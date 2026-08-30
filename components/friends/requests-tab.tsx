"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface RequestUser {
  id: string
  name: string | null
  image: string | null
  email: string
}

interface FriendRequest {
  id: string
  createdAt: string
  user: RequestUser
}

interface RequestsTabProps {
  initialIncoming: FriendRequest[]
  initialOutgoing: FriendRequest[]
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoString))
}

interface IncomingRowProps {
  request: FriendRequest
  onAccept: (id: string) => void
  onDecline: (id: string) => void
  removing: boolean
}

function IncomingRow({ request, onAccept, onDecline, removing }: IncomingRowProps) {
  return (
    <li className="flex items-center gap-4 py-3">
      <Avatar user={request.user} size={40} alt={request.user.name ?? request.user.email} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {request.user.name ?? request.user.email}
        </p>
        <p className="text-xs text-muted-foreground">Sent {relativeTime(request.createdAt)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="brand"
          size="sm"
          onClick={() => onAccept(request.id)}
          disabled={removing}
        >
          Accept
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDecline(request.id)}
          disabled={removing}
        >
          Decline
        </Button>
      </div>
    </li>
  )
}

interface OutgoingRowProps {
  request: FriendRequest
  onCancel: (id: string) => void
  removing: boolean
}

function OutgoingRow({ request, onCancel, removing }: OutgoingRowProps) {
  return (
    <li className="flex items-center gap-4 py-3">
      <Avatar user={request.user} size={40} alt={request.user.name ?? request.user.email} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {request.user.name ?? request.user.email}
        </p>
        <p className="text-xs text-muted-foreground">Sent {relativeTime(request.createdAt)}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onCancel(request.id)}
        disabled={removing}
      >
        Cancel
      </Button>
    </li>
  )
}

export function RequestsTab({ initialIncoming, initialOutgoing }: RequestsTabProps) {
  const router = useRouter()
  const [incoming, setIncoming] = useState<FriendRequest[]>(initialIncoming)
  const [outgoing, setOutgoing] = useState<FriendRequest[]>(initialOutgoing)
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  const handleAccept = useCallback(async (id: string) => {
    setRemovingIds((prev) => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/friends/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      })
      if (res.ok) {
        setIncoming((prev) => prev.filter((r) => r.id !== id))
        router.refresh()
      }
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [router])

  const handleDecline = useCallback(async (id: string) => {
    setRemovingIds((prev) => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/friends/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      })
      if (res.ok) {
        setIncoming((prev) => prev.filter((r) => r.id !== id))
      }
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const handleCancel = useCallback(async (id: string) => {
    setRemovingIds((prev) => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/friends/requests/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setOutgoing((prev) => prev.filter((r) => r.id !== id))
      }
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const bothEmpty = incoming.length === 0 && outgoing.length === 0

  if (bothEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-base text-muted-foreground">No pending requests.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the Add tab to send a friend request.
        </p>
      </div>
    )
  }

  return (
    <div>
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Incoming
        </h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No new requests.</p>
        ) : (
          <ul className="divide-y divide-border">
            {incoming.map((r) => (
              <IncomingRow
                key={r.id}
                request={r}
                onAccept={handleAccept}
                onDecline={handleDecline}
                removing={removingIds.has(r.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <Separator className="my-8" />

      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Sent
        </h2>
        {outgoing.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            You have not sent any requests yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {outgoing.map((r) => (
              <OutgoingRow
                key={r.id}
                request={r}
                onCancel={handleCancel}
                removing={removingIds.has(r.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
