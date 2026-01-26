import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@email-ai/database";

/**
 * Auth.js v5 configuration with Prisma adapter.
 *
 * OAuth providers (Google, Microsoft) will be configured in subsequent subtasks.
 * The Prisma adapter enables persistent sessions and account linking in the database.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [],
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
