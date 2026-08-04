import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { SkipLink } from "@/components/auth/skip-link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh grid grid-rows-[auto_1fr_auto] bg-background">
      <header className="px-6 md:px-8 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold"
        >
          <LogoMark className="size-6 text-brand" />
          Event Atlas
        </Link>
      </header>

      <main
        id="main"
        className="flex items-center justify-center px-4 py-10 md:py-16 relative overflow-hidden"
      >
        <SkipLink />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-10%,var(--brand-soft),transparent_60%)]"
        />
        {children}
      </main>

      <footer className="px-6 md:px-8 pb-6 text-xs text-muted-foreground text-center">
        <p>&copy; {new Date().getFullYear()} Event Atlas</p>
      </footer>
    </div>
  );
}
