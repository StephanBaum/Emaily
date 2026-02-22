import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/inbox/sidebar";
import { SessionProvider } from "next-auth/react";
import { ThreadUpdatesProvider } from "@/contexts/thread-updates-context";
import { PreferencesProvider } from "@/contexts/preferences-context";
import { SWRProvider } from "@/components/swr-provider";
import { prisma } from "@/lib/prisma";
import type { UserPreferences } from "@emaily/shared";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Redirect admins who haven't completed onboarding
  if (session.user.role === "admin") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    });
    const prefs = (user?.preferences ?? {}) as unknown as UserPreferences;
    if (!prefs.onboardingCompleted) {
      redirect("/onboarding");
    }
  }

  return (
    <SessionProvider session={session}>
      <SWRProvider>
        <PreferencesProvider>
          <ThreadUpdatesProvider>
            <div className="flex h-screen overflow-hidden">
              <Suspense>
                <Sidebar />
              </Suspense>
              <main className="flex-1 overflow-auto">{children}</main>
            </div>
          </ThreadUpdatesProvider>
        </PreferencesProvider>
      </SWRProvider>
    </SessionProvider>
  );
}
