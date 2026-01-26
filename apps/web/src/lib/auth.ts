import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
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
 * Microsoft Graph API scopes required for email client functionality.
 * - Mail.Read: Read access to user's mailbox
 * - Mail.ReadWrite: Read and write access to user's mailbox (archive, delete, modify)
 * - Mail.Send: Send emails on behalf of the user
 * - offline_access: Required for refresh tokens to maintain persistent access
 */
const MICROSOFT_MAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "Mail.Read",
  "Mail.ReadWrite",
  "Mail.Send",
].join(" ");

/**
 * Auth.js v5 configuration with Prisma adapter.
 *
 * Google OAuth is configured with Gmail API scopes for full email client functionality.
 * Microsoft Entra ID (Azure AD) is configured with Microsoft Graph Mail scopes.
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
    MicrosoftEntraId({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      // Use "common" to allow any Microsoft account (personal and work/school)
      // Use "organizations" for work/school accounts only
      // Use "consumers" for personal Microsoft accounts only
      // Or use a specific tenant ID for a single organization
      tenantId: process.env.AZURE_AD_TENANT_ID || "common",
      authorization: {
        params: {
          scope: MICROSOFT_MAIL_SCOPES,
          prompt: "consent",
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
  events: {
    /**
     * Event handler called after OAuth sign-in completes.
     * Creates or updates EmailAccount for email syncing.
     */
    async signIn({ user, account }) {
      if (!account || !user?.id || !account.access_token) {
        return;
      }

      // Map OAuth provider to email provider type
      const emailProvider = account.provider === "google" ? "gmail" : "outlook";

      try {
        // Check if EmailAccount already exists for this user and provider
        const existingEmailAccount = await prisma.emailAccount.findFirst({
          where: {
            userId: user.id,
            provider: emailProvider,
          },
        });

        if (existingEmailAccount) {
          // Update existing EmailAccount with new tokens
          await prisma.emailAccount.update({
            where: { id: existingEmailAccount.id },
            data: {
              accessToken: account.access_token,
              refreshToken: account.refresh_token || existingEmailAccount.refreshToken,
              updatedAt: new Date(),
            },
          });
        } else {
          // Create new EmailAccount for email syncing
          await prisma.emailAccount.create({
            data: {
              userId: user.id,
              provider: emailProvider,
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
            },
          });
        }
      } catch (error) {
        // Log error but don't fail the sign-in
        // The user can still authenticate, just email sync may need to be set up separately
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("Failed to create/update EmailAccount:", error);
        }
      }
    },
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
