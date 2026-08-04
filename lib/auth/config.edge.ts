import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfigEdge: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          emailVerified: profile.email_verified ? new Date() : null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token }) {
      return token;
    },
    session({ session, token }) {
      const tokenUserId = typeof token.userId === "string" ? token.userId : null;
      if (tokenUserId) {
        session.user.id = tokenUserId;
      }
      session.user.needsZip = token.needsZip === true;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};
