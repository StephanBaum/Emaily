import { handlers } from "@/lib/auth";

/**
 * Auth.js v5 API route handlers for Next.js App Router.
 *
 * This catch-all route handles all authentication endpoints:
 * - GET /api/auth/signin - Sign in page
 * - GET /api/auth/signout - Sign out page
 * - GET /api/auth/callback/:provider - OAuth callback
 * - GET /api/auth/session - Get session
 * - POST /api/auth/signin/:provider - Start OAuth flow
 * - POST /api/auth/signout - Sign out action
 */
export const { GET, POST } = handlers;
