import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic check only: bounce visitors without a session cookie to /login.
// Real authorization happens in getCurrentChurch() on the server.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/members/:path*",
    "/finances/:path*",
    "/giving-analytics/:path*",
    "/growth/:path*",
    "/billing/:path*",
    "/events/:path*",
    "/event-analytics/:path*",
    "/attendance/:path*",
    "/follow-up/:path*",
    "/welfare/:path*",
    "/announcements/:path*",
    "/message-center/:path*",
    "/visitor-conversion/:path*",
    "/sermon-ai/:path*",
    "/settings/:path*",
    "/setup-church",
    "/print/:path*",
  ],
};
