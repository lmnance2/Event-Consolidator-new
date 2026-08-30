import { cache } from "react";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

const nextAuth = NextAuth(authConfig);

export const { handlers, signIn, signOut } = nextAuth;

// Per-request dedupe: layout + page both call auth(); without this each
// invocation triggers the jwt callback + a Prisma sessionVersion lookup.
export const auth = cache(nextAuth.auth);
