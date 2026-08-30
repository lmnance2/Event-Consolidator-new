import { redirect } from "next/navigation"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db/client"
import { isPro } from "@/lib/subscription/is-pro"
import { getFriendActivityPage } from "@/lib/friends/activity"
import { FriendsTabs } from "@/components/friends/friends-tabs"

async function getFriendsPageData(userId: string, userIsPro: boolean) {
  const [friendships, requests, activityData] = await Promise.all([
    prisma.friendship.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      select: {
        id: true,
        createdAt: true,
        userA: { select: { id: true, name: true, image: true } },
        userB: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: {
        OR: [
          { toUserId: userId, status: "PENDING" },
          { fromUserId: userId, status: "PENDING" },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        fromUserId: true,
        toUserId: true,
        fromUser: { select: { id: true, name: true, image: true, email: true } },
        toUser: { select: { id: true, name: true, image: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    userIsPro ? getFriendActivityPage({ userId, cursor: null }) : Promise.resolve({ items: [], nextCursor: null }),
  ])

  const friends = friendships.map((f) => {
    const other = f.userA.id === userId ? f.userB : f.userA
    return {
      id: other.id,
      name: other.name,
      image: other.image,
      friendsSince: f.createdAt.toISOString(),
    }
  })

  const incoming = requests
    .filter((r) => r.toUserId === userId)
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      user: r.fromUser,
    }))

  const outgoing = requests
    .filter((r) => r.fromUserId === userId)
    .map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      user: r.toUser,
    }))

  return { friends, incoming, outgoing, activityItems: activityData.items, activityNextCursor: activityData.nextCursor }
}

function resolveDefaultTab(
  incoming: { id: string }[],
  friends: { id: string }[],
  searchTab: string | null
): string {
  if (searchTab && ["friends", "requests", "add", "activity"].includes(searchTab)) {
    return searchTab
  }
  if (incoming.length > 0) return "requests"
  if (friends.length === 0) return "add"
  return "friends"
}

interface FriendsPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const userId = session.user.id

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  })
  const userIsPro = isPro(subscription)

  const { friends, incoming, outgoing, activityItems, activityNextCursor } =
    await getFriendsPageData(userId, userIsPro)

  const resolvedParams = await searchParams
  const defaultTab = resolveDefaultTab(incoming, friends, resolvedParams.tab ?? null)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See what your friends are going to and share events with them.
        </p>
      </header>

      <Suspense>
        <FriendsTabs
          friends={friends}
          incoming={incoming}
          outgoing={outgoing}
          isPro={userIsPro}
          activityItems={activityItems}
          activityNextCursor={activityNextCursor}
          defaultTab={defaultTab}
        />
      </Suspense>
    </div>
  )
}
