import { auth } from "@/lib/auth";
import { Header } from "@/components/main/header";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-svh flex flex-col">
      <Header
        userName={session?.user?.name ?? null}
        userEmail={session?.user?.email ?? null}
        userImage={session?.user?.image ?? null}
      />
      <main className="flex-1">{children}</main>
    </div>
  );
}
