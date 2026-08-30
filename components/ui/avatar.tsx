"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"

import { cn } from "@/lib/utils"

const MUTED_TINTS = [
  "bg-slate-100 text-slate-600",
  "bg-stone-100 text-stone-600",
  "bg-zinc-100 text-zinc-600",
  "bg-neutral-100 text-neutral-600",
  "bg-gray-100 text-gray-600",
]

function hashId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function getTint(id: string | undefined): string {
  if (!id) return "bg-muted text-muted-foreground"
  return MUTED_TINTS[hashId(id) % MUTED_TINTS.length] ?? "bg-muted text-muted-foreground"
}

interface AvatarUser {
  id?: string
  name?: string | null
  image?: string | null
}

interface AvatarProps {
  user: AvatarUser
  size?: number
  className?: string
  alt?: string
}

function Avatar({ user, size = 40, className, alt }: AvatarProps) {
  const initial = user.name ? user.name[0]?.toUpperCase() : "?"
  const tint = getTint(user.id)
  const displayAlt = alt !== undefined ? alt : (user.name ?? "")

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        className
      )}
      style={{ width: size, height: size }}
    >
      {user.image && (
        <AvatarPrimitive.Image
          src={user.image}
          alt={displayAlt}
          className="h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full text-xs font-medium",
          tint
        )}
        style={{ fontSize: Math.max(size * 0.35, 10) }}
      >
        {initial}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}

export { Avatar }
export type { AvatarUser }
