import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      needsZip: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    emailVerified?: Date | null;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    sessionVersion?: number;
    needsZip?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    sessionVersion?: number;
    needsZip?: boolean;
  }
}
