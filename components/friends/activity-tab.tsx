"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LoadMoreButton } from "@/components/feed/load-more-button"

interface ActivityActor {
  id: string
  name: string | null
  image: string | null
}

interface ActivityEvent {
  id: string
  title: string
  imageUrl: string | null
  startTime: string
  category: string
}

interface ActivityItem {
  id: string
  kind: "GOING" | "SAVED"
  createdAt: string
  actor: ActivityActor
  event: ActivityEvent
}

interface ActivityTabProps {
  isPro: boolean
  initialItems: ActivityItem[]
  initialNextCursor: string | null
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

function formatDay(isoString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(isoString))
}

function getDayLabel(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const dateStr = date.toISOString().slice(0, 10)
  if (dateStr === todayStr) return "Today"
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateStr === yesterday.toISOString().slice(0, 10)) return "Yesterday"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function groupByDay(items: ActivityItem[]): Array<{ label: string; items: ActivityItem[] }> {
  const groups: Map<string, ActivityItem[]> = new Map()
  for (const item of items) {
    const dateKey = new Date(item.createdAt).toISOString().slice(0, 10)
    const existing = groups.get(dateKey)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(dateKey, [item])
    }
  }
  return Array.from(groups.entries()).map(([dateKey, groupItems]) => ({
    label: getDayLabel(dateKey + "T12:00:00Z"),
    items: groupItems,
  }))
}

function ProUpsell() {
  return (
    <div className="rounded-lg border border-border p-8 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-brand" aria-hidden />
      <p className="mt-3 text-base font-medium">Activity is a Pro feature</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
        See what your friends are saving and going to as it happens.
      </p>
      <Button
        variant="brand"
        size="sm"
        className="mt-5"
        disabled
        title="Coming soon"
      >
        Upgrade to Pro
      </Button>
    </div>
  )
}

export function ActivityTab({ isPro, initialItems, initialNextCursor }: ActivityTabProps) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [isLoading, setIsLoading] = useState(false)

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoading) return
    setIsLoading(true)
    try {
      const url = `/api/social/activity?cursor=${encodeURIComponent(nextCursor)}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = (await res.json()) as { items: ActivityItem[]; nextCursor: string | null }
      setItems((prev) => [...prev, ...data.items])
      setNextCursor(data.nextCursor)
    } finally {
      setIsLoading(false)
    }
  }, [nextCursor, isLoading])

  if (!isPro) {
    return <ProUpsell />
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nothing new from your friends yet.
      </p>
    )
  }

  const groups = groupByDay(items)

  return (
    <div>
      {groups.map((group) => (
        <section key={group.label} className="mb-6">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide sticky top-16 bg-background py-2">
            {group.label}
          </h2>
          <ul className="divide-y divide-border">
            {group.items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-4 py-3">
                <Avatar user={item.actor} size={36} alt={item.actor.name ?? ""} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{item.actor.name ?? "A friend"}</span>
                    <span className="text-muted-foreground">
                      {item.kind === "GOING" ? " is going to " : " saved "}
                    </span>
                    <Link
                      href={`/feed?event=${item.event.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.event.title}
                    </Link>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(item.createdAt)} · {formatDay(item.event.startTime)}
                  </p>
                </div>
                {item.event.imageUrl && (
                  <Image
                    src={item.event.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="rounded-md object-cover shrink-0"
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {nextCursor && (
        <LoadMoreButton onLoadMore={loadMore} isLoading={isLoading} />
      )}
    </div>
  )
}
