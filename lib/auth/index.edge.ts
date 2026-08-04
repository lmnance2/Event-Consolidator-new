import NextAuth from "next-auth";
import { authConfigEdge } from "@/lib/auth/config.edge";

export const { auth } = NextAuth(authConfigEdge);
