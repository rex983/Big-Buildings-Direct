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
const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

// Routes accessible without auth
const publicAccessRoutes = ["/sign"];

// API routes that should never be intercepted by test mode
const testModeBypassRoutes = [
  "/api/auth",
  "/api/webhooks",
];

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;
  const method = req.method;

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
    const callbackUrl = nextUrl.searchParams.get("callbackUrl");
    return NextResponse.redirect(new URL(callbackUrl || "/dashboard", nextUrl));
  }

  // Redirect unauthenticated users to login for protected routes
  if (!isLoggedIn && protectedRoutes.some((route) => pathname.startsWith(route))) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all routes except static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
