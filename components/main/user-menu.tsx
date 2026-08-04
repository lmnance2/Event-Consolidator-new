"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import { signOut } from "next-auth/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  name: string | null;
  email: string | null;
  image: string | null;
}

function UserAvatar({ name, image }: { name: string | null; image: string | null }) {
  const initial = name ? name[0]?.toUpperCase() : "?";

  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? "User avatar"}
        width={32}
        height={32}
        className="rounded-full object-cover size-8"
      />
    );
  }

  return (
    <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-soft text-brand text-sm font-medium select-none">
      {initial}
    </span>
  );
}

export function UserMenu({ name, email, image }: UserMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="User menu"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm transition-colors duration-150",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        )}
      >
        <UserAvatar name={name} image={image} />
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="px-2 py-1.5">
          {name && (
            <p className="text-sm font-medium truncate">{name}</p>
          )}
          {email && (
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          )}
        </div>
        <Separator className="my-1" />
        <Link
          href="/settings"
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
            "hover:bg-muted transition-colors duration-150"
          )}
        >
          <Settings className="size-4 text-muted-foreground" aria-hidden />
          Settings
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
            "hover:bg-muted transition-colors duration-150"
          )}
        >
          <LogOut className="size-4 text-muted-foreground" aria-hidden />
          Sign out
        </button>
      </PopoverContent>
    </Popover>
  );
}
