import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";

// Защита /boards и /api/boards — редирект на /login если нет сессии.
// Auth-страницы (/login, /register) и публичные роуты пропускаем.
export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const protectedPath =
    nextUrl.pathname.startsWith("/boards") ||
    nextUrl.pathname.startsWith("/api/boards");

  if (protectedPath && !isLoggedIn) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("next", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(url);
  }

  // почему: если уже залогинен и идёшь на /login или /register — отправим на /boards
  const isAuthPage =
    nextUrl.pathname === "/login" || nextUrl.pathname === "/register";
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/boards", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // почему такой matcher: пропускаем next-internal, статику и api/auth (он публичный)
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
