import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import { verifyWerkzeugHash } from "./lib/auth/werkzeug";
import { verify } from "otplib";

const prisma = new PrismaClient();

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret:
    process.env.AUTH_SECRET ||
    process.env.SECRET_KEY ||
    "control-access-dev-secret",
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        totp: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await prisma.users.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user) return null;

        const isPasswordValid = await verifyWerkzeugHash(
          user.password,
          credentials.password as string,
        );

        if (!isPasswordValid) return null;

        // TOTP check if enabled
        if (user.mfa_enabled && user.totp_secret) {
          if (!credentials.totp) return null; // MFA required but not provided

          const isValidTotp = verify({
            token: credentials.totp as string,
            secret: user.totp_secret,
          });

          if (!isValidTotp) {
            // Check backup codes
            const backupCodes = user.mfa_backup_codes
              ? user.mfa_backup_codes.split(" ")
              : [];
            if (!backupCodes.includes(credentials.totp as string)) {
              return null;
            }
          }
        }

        return {
          id: user.id.toString(),
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
});
