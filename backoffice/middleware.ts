import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "backoffice_session";

const PUBLIC_ROUTES = ["/login", "/api/auth/login", "/api/auth/logout", "/apkdownload", "/manifest.webmanifest", "/driver-sw.js"];

function isPublicRoute(pathname: string) {
  return (
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/apkdownload") ||
    pathname.startsWith("/driver") ||
    pathname.startsWith("/api/driver/") ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/mobile/") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/_next") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webmanifest")
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    if (pathname === "/login" && request.cookies.get(SESSION_COOKIE_NAME)?.value) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
