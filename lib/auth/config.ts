import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[Event Atlas] Missing required environment variable: ${name}. ` +
        `Ensure it is set in .env.local before starting the server.`
    );
  }
  return value;
}

function checkRequiredEnv(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("GOOGLE_CLIENT_ID");
  requireEnv("GOOGLE_CLIENT_SECRET");
  requireEnv("RESEND_API_KEY");
  requireEnv("OPENCAGE_API_KEY");
  requireEnv("UPSTASH_REDIS_REST_URL");
  requireEnv("UPSTASH_REDIS_REST_TOKEN");
}

checkRequiredEnv();

export interface GoogleProfile {
  sub: string;
  name: string;
  email: string;
  picture: string;
  email_verified: boolean;
}

export function mapGoogleProfile(profile: GoogleProfile) {
  return {
    id: profile.sub,
    name: profile.name,
    email: profile.email,
    image: profile.picture,
    emailVerified: profile.email_verified ? new Date() : null,
  };
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      profile: mapGoogleProfile,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            sessionVersion: true,
          },
        });

        if (!user || !user.passwordHash) return null;

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      if (!user.id) return;

      await prisma.userPreferences.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });

      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
    },
  },
  callbacks: {
    async signIn() {
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      if (user && account) {
        const userId = user.id as string;

        let dbUser: {
          id: string;
          sessionVersion: number;
          zipCode: string | null;
        } | null = null;

        try {
          dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              sessionVersion: true,
              zipCode: true,
            },
          });
        } catch {
          return token;
        }

        if (!dbUser) return null;

        token.userId = dbUser.id;
        token.sessionVersion = dbUser.sessionVersion;
        token.needsZip = !dbUser.zipCode;

        return token;
      }

      const tokenUserId = typeof token.userId === "string" ? token.userId : null;
      if (!tokenUserId) return null;

      if (trigger === "update") {
        let dbUser: {
          sessionVersion: number;
          zipCode: string | null;
        } | null = null;

        try {
          dbUser = await prisma.user.findUnique({
            where: { id: tokenUserId },
            select: {
              sessionVersion: true,
              zipCode: true,
            },
          });
        } catch {
          return token;
        }

        if (!dbUser) return null;

        token.sessionVersion = dbUser.sessionVersion;
        token.needsZip = !dbUser.zipCode;
        return token;
      }

      let dbUser: { sessionVersion: number } | null = null;

      try {
        dbUser = await prisma.user.findUnique({
          where: { id: tokenUserId },
          select: { sessionVersion: true },
        });
      } catch {
        return token;
      }

      if (!dbUser) return null;

      const tokenSessionVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : null;
      if (dbUser.sessionVersion !== tokenSessionVersion) {
        return null;
      }

      return token;
    },

    async session({ session, token }) {
      const tokenUserId = typeof token.userId === "string" ? token.userId : null;
      if (tokenUserId) {
        session.user.id = tokenUserId;
      }
      session.user.needsZip = token.needsZip === true;
      return session;
    },
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
