import { auth } from "@/lib/auth";
import { Header } from "@/components/main/header";
import { EventStateProvider } from "@/components/providers/event-state-provider";
import { SaveLimitDialog } from "@/components/feed/save-limit-dialog";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-svh flex flex-col">
      <EventStateProvider>
        <Header
          userName={session?.user?.name ?? null}
          userEmail={session?.user?.email ?? null}
          userImage={session?.user?.image ?? null}
        />
        <main className="flex-1">{children}</main>
        <SaveLimitDialog />
      </EventStateProvider>
    </div>
  );
}
