import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config shared between middleware and the full auth.
 * Must NOT import Prisma or any Node.js-only modules.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, populate the token from the user object
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.teamId = user.teamId;
        token.teamName = user.teamName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.teamId = token.teamId as string;
        session.user.teamName = token.teamName as string;
      }
      return session;
    },
  },
  providers: [], // Populated in lib/auth.ts — required here for type safety
} satisfies NextAuthConfig;
