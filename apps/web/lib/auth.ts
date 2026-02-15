import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { verifyPassword, verifyTotpToken } from "@emaily/security";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      // Base callback: populate token on sign-in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.teamId = user.teamId;
        token.teamName = user.teamName;
      }

      // Re-read user data from DB when session is updated (e.g. profile change)
      // or periodically (every 5 minutes) to catch team name changes etc.
      // This only runs server-side (Node.js runtime), never in edge middleware.
      if (trigger === "update" || !token.lastRefreshed ||
          Date.now() - (token.lastRefreshed as number) > 5 * 60 * 1000) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { name: true, role: true, teamId: true, team: { select: { name: true } } },
          });
          if (dbUser) {
            token.name = dbUser.name;
            token.role = dbUser.role;
            token.teamId = dbUser.teamId;
            token.teamName = dbUser.team.name;
          }
        } catch {
          // DB unavailable — keep existing token data
        }
        token.lastRefreshed = Date.now();
      }

      return token;
    },
  },
});
