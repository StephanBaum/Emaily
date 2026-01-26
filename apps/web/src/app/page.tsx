import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginButton } from "@/components/auth/login-button";

/**
 * Mail icon component for the hero section
 */
function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

/**
 * SparklesIcon for AI feature indicator
 */
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
    </svg>
  );
}

/**
 * Feature item component for the feature list
 */
function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
      <SparklesIcon className="h-4 w-4 text-primary flex-shrink-0" />
      {children}
    </li>
  );
}

/**
 * Home page serves as the login/landing page for the Email AI Client.
 *
 * If the user is already authenticated, they are redirected to the inbox.
 * Otherwise, they see the login options with Gmail and Outlook OAuth buttons.
 */
export default async function Home() {
  const session = await auth();

  // Redirect authenticated users to inbox
  if (session?.user) {
    redirect("/inbox");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <div className="w-full max-w-md space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <MailIcon className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Email AI Client</h1>
          <p className="text-muted-foreground">
            AI-powered email management for inbox zero
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Connect your email</CardTitle>
            <CardDescription>
              Sign in with your email provider to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginButton provider="google" />
            <LoginButton provider="azure-ad" />
          </CardContent>
        </Card>

        {/* Features List */}
        <Card className="bg-muted/50 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 text-primary" />
              AI-Powered Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <FeatureItem>Smart email categorization</FeatureItem>
              <FeatureItem>Priority inbox with AI ranking</FeatureItem>
              <FeatureItem>One-click smart reply suggestions</FeatureItem>
              <FeatureItem>AI-assisted email composition</FeatureItem>
            </ul>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          By connecting your email, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </main>
  );
}
