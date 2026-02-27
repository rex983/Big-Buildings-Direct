import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/orders",
  "/customers",
  "/communications",
  "/team",
  "/pay",
  "/settings",
  "/portal",
  "/my-orders",
  "/account",
];

// Routes that are public (no auth required)
const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password", "/change-password"];

// Routes accessible without auth
const publicAccessRoutes = ["/sign"];

// API routes that should never be intercepted by test mode
const testModeBypassRoutes = [
  "/api/auth",
  "/api/webhooks",
];

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function getBaseUrl(req: Parameters<Parameters<typeof auth>[0]>[0]) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  return `${proto}://${host}`;
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;
  const method = req.method;
  const baseUrl = getBaseUrl(req);

  // ── Test Mode: intercept mutating API requests ──
  if (
    pathname.startsWith("/api/") &&
    MUTATING_METHODS.includes(method) &&
    !testModeBypassRoutes.some((route) => pathname.startsWith(route))
  ) {
    const testModeCookie = req.cookies.get("bbd-test-mode")?.value;
    if (testModeCookie === "true") {
      return NextResponse.json(
        {
          success: true,
          testMode: true,
          message: "Test mode: action simulated, no data was changed.",
          data: {},
        },
        { status: 200 }
      );
    }
  }

  // ── Non-API routes: existing auth logic ──
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow public access routes (like document signing)
  if (publicAccessRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from auth pages
  if (isLoggedIn && publicRoutes.some((route) => pathname.startsWith(route))) {
    const mustChangePassword = req.auth?.user?.mustChangePassword;

    // Don't redirect away from /change-password if user must change their password
    if (mustChangePassword && pathname.startsWith("/change-password")) {
      return NextResponse.next();
    }

    const callbackUrl = nextUrl.searchParams.get("callbackUrl");
    return NextResponse.redirect(new URL(callbackUrl || "/dashboard", baseUrl));
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isLoggedIn && protectedRoutes.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL("/login", baseUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Force password change: redirect logged-in users who must change their password
  if (
    isLoggedIn &&
    req.auth?.user?.mustChangePassword &&
    !pathname.startsWith("/change-password") &&
    !pathname.startsWith("/api/")
  ) {
    return NextResponse.redirect(new URL("/change-password", baseUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
