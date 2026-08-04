import { Lock } from "lucide-react";

export function ProLockBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-sm bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest text-brand">
      <Lock size={10} aria-hidden />
      Pro
    </span>
  );
}
