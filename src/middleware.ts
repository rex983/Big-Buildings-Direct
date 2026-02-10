import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Routes that require authentication
const protectedRoutes = [
  "/dashboard",
  "/orders",
  "/customers",
  "/communications",
  "/team",
  "/settings",
  "/portal",
  "/my-orders",
  "/account",
];

// Routes that are public (no auth required)
const publicRoutes = ["/login", "/register", "/forgot-password", "/reset-password"];

// Routes accessible without auth
const publicAccessRoutes = ["/sign"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const pathname = nextUrl.pathname;

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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
