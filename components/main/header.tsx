import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "./user-menu";

interface HeaderProps {
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
}

export function Header({ userName, userEmail, userImage }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border/70">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-14 flex items-center justify-between">
        <Link href="/feed" className="inline-flex items-center gap-2" aria-label="Event Atlas home">
          <Logo className="text-sm font-semibold" />
        </Link>
        <UserMenu name={userName} email={userEmail} image={userImage} />
      </div>
    </header>
  );
}
