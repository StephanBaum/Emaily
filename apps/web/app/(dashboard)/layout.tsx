import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/inbox/sidebar";
import { SessionProvider } from "next-auth/react";
import { ThreadUpdatesProvider } from "@/contexts/thread-updates-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SessionProvider session={session}>
      <ThreadUpdatesProvider>
        <div className="flex h-screen overflow-hidden">
          <Suspense>
            <Sidebar />
          </Suspense>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </ThreadUpdatesProvider>
    </SessionProvider>
  );
}
