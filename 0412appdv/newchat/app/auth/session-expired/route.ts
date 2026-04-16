import { NextResponse } from "next/server";

function shouldClearAuthCookie(name: string) {
  return name.startsWith("sb-") || name.includes("supabase") || name.includes("auth-token");
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const segment of cookieHeader.split(";")) {
    const [rawName] = segment.split("=");
    const cookieName = rawName?.trim();

    if (!cookieName || !shouldClearAuthCookie(cookieName)) {
      continue;
    }

    response.cookies.set(cookieName, "", {
      maxAge: 0,
      expires: new Date(0),
      path: "/"
    });
  }

  return response;
}
