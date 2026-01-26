import { Metadata } from "next";
import { MainLayout } from "@/components/layout/main-layout";

export const metadata: Metadata = {
  title: "Inbox",
  description: "View and manage your emails with AI-powered categorization",
};

/**
 * InboxLayout wraps the inbox pages with the main application layout.
 *
 * This layout provides:
 * - Fixed header with search and user menu
 * - Collapsible sidebar with navigation and category filters
 * - Responsive design for mobile and desktop
 */
export default function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
