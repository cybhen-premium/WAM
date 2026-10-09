import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Edge security check: bounce visitors without a session cookie to /login.
// Detailed multi-tenant authorization happens on the server via requireChurch() & requireModule().
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/portal")) {
    return NextResponse.next();
  }

  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API endpoints, Better Auth, webhooks, cron)
     * - _next/static, _next/image (Next.js assets)
     * - favicon.ico, images and public static files
     * - public auth routes: login, signup, two-factor, setup-2fa, forgot-password, force-password-change
     * - member portal routes: /portal, /portal/login
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$|login|signup|two-factor|setup-2fa|forgot-password|force-password-change|portal).*)",
  ],
};
