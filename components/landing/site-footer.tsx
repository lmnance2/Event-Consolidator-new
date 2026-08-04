import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="py-10 border-t border-border">
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Event Atlas
        </p>
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          Log in
        </Link>
      </div>
    </footer>
  );
}
