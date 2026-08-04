import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FinalCTA() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-24 text-center relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50%_60%_at_50%_50%,var(--brand-soft),transparent_70%)]"
      />
      <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-0.03em] leading-[1.05]">
        Stop scrolling four apps.
      </h2>
      <p className="mt-4 text-lg text-muted-foreground">
        One feed. Filtered by what you like. Free to start.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/signup"
          className={cn(buttonVariants({ variant: "brand", size: "lg" }), "active:scale-[0.98]")}
        >
          Sign up free
        </Link>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "active:scale-[0.98]")}
        >
          Log in
        </Link>
      </div>
    </section>
  );
}
