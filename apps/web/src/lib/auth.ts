import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import { prisma } from "@email-ai/database";

/**
 * Gmail API scopes required for email client functionality.
 * - gmail.readonly: Read access to emails, labels, and settings
 * - gmail.send: Send emails on behalf of the user
 * - gmail.modify: Archive, delete, and modify email labels
 */
const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

/**
 * Auth.js v5 configuration with Prisma adapter.
 *
 * Google OAuth is configured with Gmail API scopes for full email client functionality.
 * Microsoft OAuth will be configured in subsequent subtasks.
 * The Prisma adapter enables persistent sessions and account linking in the database.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: GMAIL_SCOPES,
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  callbacks: {
    /**
     * JWT callback - called when JWT is created or updated
     */
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }
      // Store OAuth access token for email API access
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.provider = account.provider;
      }
      return token;
    },
    /**
     * Session callback - expose user id and tokens to the client session
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});

/**
 * Type augmentation for next-auth
 * Extends the built-in types with custom properties
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
