import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { verifyPassword, verifyTotpToken } from "@emaily/security";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const totpCode = credentials.totpCode as string | undefined;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { team: true },
        });

        if (!user) {
          throw new Error("Invalid credentials");
        }

        const isValidPassword = await verifyPassword(password, user.passwordHash);
        if (!isValidPassword) {
          throw new Error("Invalid credentials");
        }

        if (user.totpEnabled && user.totpSecret) {
          if (!totpCode) {
            throw new Error("TOTP_REQUIRED");
          }
          const isValidTotp = await verifyTotpToken(user.totpSecret, totpCode);
          if (!isValidTotp) {
            throw new Error("Invalid 2FA code");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          teamId: user.teamId,
          teamName: user.team.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
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
        session.user.role = token.role as string;
        session.user.teamId = token.teamId as string;
        session.user.teamName = token.teamName as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
