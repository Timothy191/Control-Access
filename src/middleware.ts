import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /api/hardware with HARDWARE_API_KEY
  if (pathname.startsWith("/api/hardware")) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.HARDWARE_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protect /api/mobile with MOBILE_API_KEY
  if (pathname.startsWith("/api/mobile")) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.MOBILE_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
