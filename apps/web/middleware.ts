import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isAuthPage = nextUrl.pathname.startsWith("/login");
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
  const isPublicApi = nextUrl.pathname.startsWith("/api/health");

  // Allow auth API routes
  if (isApiAuth || isPublicApi) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/inbox", nextUrl));
  }

  // Redirect unauthenticated users to login
  if (!isAuthPage && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (public files)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*$).*)",
  ],
};
