"use client";

export function SkipLink() {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    document.getElementById("auth-primary")?.focus();
  }

  return (
    <a
      href="#auth-primary"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-background focus:border focus:border-border focus:rounded-md focus:px-3 focus:py-1.5 focus:text-sm"
    >
      Skip to form
    </a>
  );
}
