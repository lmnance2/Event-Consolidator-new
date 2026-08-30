"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  TabsRoot,
  TabsList,
  TabsTab,
  TabsIndicator,
  TabsPanel,
} from "@/components/ui/tabs"
import { FriendsTab } from "./friends-tab"
import { RequestsTab } from "./requests-tab"
import { AddTab } from "./add-tab"
import { ActivityTab } from "./activity-tab"

interface Friend {
  id: string
  name: string | null
  image: string | null
  friendsSince: string
}

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

interface ActivityItem {
  id: string
  kind: "GOING" | "SAVED"
  createdAt: string
  actor: { id: string; name: string | null; image: string | null }
  event: {
    id: string
    title: string
    imageUrl: string | null
    startTime: string
    category: string
  }
}

interface FriendsTabsProps {
  friends: Friend[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  isPro: boolean
  activityItems: ActivityItem[]
  activityNextCursor: string | null
  defaultTab: string
}

const VALID_TABS = ["friends", "requests", "add", "activity"] as const
type TabValue = (typeof VALID_TABS)[number]

export function FriendsTabs({
  friends,
  incoming,
  outgoing,
  isPro,
  activityItems,
  activityNextCursor,
  defaultTab,
}: FriendsTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const tabParam = searchParams.get("tab")
  const activeTab: TabValue =
    tabParam && (VALID_TABS as readonly string[]).includes(tabParam)
      ? (tabParam as TabValue)
      : (defaultTab as TabValue)

  const pendingCount = incoming.length

  const handleTabChange = (value: TabValue | null) => {
    if (!value) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <TabsRoot value={activeTab} onValueChange={(v) => handleTabChange(v as TabValue)}>
      <TabsList className="mb-8">
        <TabsTab value="friends">Friends</TabsTab>
        <TabsTab value="requests">
          <span className="inline-flex items-center gap-1.5">
            Requests
            {pendingCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                {pendingCount}
              </Badge>
            )}
          </span>
        </TabsTab>
        <TabsTab value="add">Add</TabsTab>
        <TabsTab value="activity">
          <span className="inline-flex items-center gap-1.5">
            Activity
            {!isPro && (
              <span className="text-[11px] text-brand" aria-hidden>
                ✦
              </span>
            )}
          </span>
        </TabsTab>
        <TabsIndicator />
      </TabsList>

      <TabsPanel value="friends">
        <FriendsTab initialFriends={friends} />
      </TabsPanel>

      <TabsPanel value="requests">
        <RequestsTab initialIncoming={incoming} initialOutgoing={outgoing} />
      </TabsPanel>

      <TabsPanel value="add">
        <AddTab />
      </TabsPanel>

      <TabsPanel value="activity">
        <ActivityTab
          isPro={isPro}
          initialItems={activityItems}
          initialNextCursor={activityNextCursor}
        />
      </TabsPanel>
    </TabsRoot>
  )
}
