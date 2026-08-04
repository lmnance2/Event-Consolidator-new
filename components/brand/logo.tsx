import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
}

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("size-6", className)}
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path
        d="M12 9V7M12 17V15M9 12H7M17 12H15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 font-semibold", className)}
    >
      <LogoMark className="text-brand" />
      <span>Event Atlas</span>
    </span>
  );
}
