import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ExternalLink, Clock } from "lucide-react"
import { prisma } from "@/lib/db/client"
import { buttonVariants } from "@/components/ui/button"
import { formatFullDate } from "@/lib/events/format"
import { cn } from "@/lib/utils"
import { Category } from "@prisma/client"
import { pickPrimarySource } from "@/lib/events/primary-source"

const CATEGORY_DISPLAY: Record<Category, string> = {
  MUSIC: "Music",
  SPORTS: "Sports",
  ARTS_THEATER: "Arts & Theater",
  FOOD_DRINK: "Food & Drink",
  NETWORKING: "Networking",
  HEALTH_WELLNESS: "Health & Wellness",
  OUTDOOR_ADVENTURE: "Outdoor & Adventure",
  FAMILY_FRIENDLY: "Family Friendly",
  COMMUNITY_CULTURE: "Community & Culture",
  NIGHTLIFE: "Nightlife",
  EDUCATION: "Education",
  OTHER: "Other",
}

async function getShareEvent(id: string) {
  return prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      startTime: true,
      endTime: true,
      venue: true,
      price: true,
      isFree: true,
      category: true,
      performerName: true,
      isActive: true,
      sources: {
        select: { provider: true, ticketUrl: true },
      },
    },
  })
}

function priceLabel(isFree: boolean, price: number | null): string {
  if (isFree) return "Free"
  if (price !== null) return `$${price}`
  return "Price not listed"
}

interface SharePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getShareEvent(id)
  if (!event) {
    return {
      title: "Event Atlas",
      robots: { index: false },
    }
  }
  return {
    title: `${event.title} - Event Atlas`,
    description:
      event.description?.slice(0, 160) ??
      `${event.title} on ${formatFullDate(event.startTime.toISOString())}`,
    openGraph: {
      title: event.title,
      description: event.description?.slice(0, 160) ?? "",
      images: event.imageUrl ? [event.imageUrl] : [],
      type: "website",
    },
    robots: { index: false, follow: true },
  }
}

export default async function ShareEventPage({ params }: SharePageProps) {
  const { id } = await params
  const event = await getShareEvent(id)

  if (!event) {
    notFound()
  }

  const primarySource = pickPrimarySource(event.sources)
  const categoryLabel = CATEGORY_DISPLAY[event.category] ?? event.category

  const SharedHeader = () => (
    <header className="border-b border-border">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-sm">
          Event Atlas
        </Link>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign in
        </Link>
      </div>
    </header>
  )

  if (!event.isActive) {
    return (
      <div className="min-h-dvh flex flex-col">
        <SharedHeader />
        <main className="max-w-md mx-auto px-4 py-16 text-center flex-1 flex flex-col items-center justify-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold">This event has ended.</h1>
          <Link href="/feed" className={cn(buttonVariants({ variant: "brand", size: "sm" }), "mt-6")}>
            Discover events
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <SharedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted">
          {event.imageUrl ? (
            <Image
              src={event.imageUrl}
              alt={event.title}
              width={800}
              height={450}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-brand-soft" />
          )}
        </div>

        <span className="mt-6 inline-flex text-xs font-medium uppercase tracking-wide text-brand">
          {categoryLabel}
        </span>

        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight">
          {event.title}
        </h1>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">When</dt>
            <dd>{formatFullDate(event.startTime.toISOString())}</dd>
          </div>
          {event.venue && (
            <div>
              <dt className="text-muted-foreground">Where</dt>
              <dd>{event.venue}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Price</dt>
            <dd>{priceLabel(event.isFree, event.price)}</dd>
          </div>
          {event.performerName && (
            <div>
              <dt className="text-muted-foreground">Performer</dt>
              <dd>{event.performerName}</dd>
            </div>
          )}
        </dl>

        {event.description && (
          <p className="mt-6 text-sm text-foreground/80 whitespace-pre-line">
            {event.description}
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          {primarySource?.ticketUrl ? (
            <a
              href={primarySource.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "brand", size: "lg" }), "flex-1")}
            >
              Get tickets <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          ) : null}
        </div>

        <div className="mt-10 rounded-lg border border-border bg-muted/40 p-5 text-center">
          <p className="text-sm font-medium">Never miss an event.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign up for reminders 24 hours before and see what your friends are going to.
          </p>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "mt-4")}>
            Try Event Atlas free
          </Link>
        </div>
      </main>
    </div>
  )
}
