import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email AI Client",
  description: "AI-powered email client for web and mobile",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
