import { auth } from "@/lib/auth/index.edge";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (req.auth.user?.needsZip && pathname !== "/onboarding/zip") {
    return NextResponse.redirect(new URL("/onboarding/zip", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!$|_next/|favicon\\.ico|.*\\..*|api/|login(?:/|$)|signup(?:/|$)|reset-password(?:/|$)|forgot-password(?:/|$)).*)",
  ],
};
