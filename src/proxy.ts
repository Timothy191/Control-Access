import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect /api/hardware, /api/mobile, /api/scan_qr, and /api/scan_rfid with API key
  if (
    pathname.startsWith("/api/hardware") ||
    pathname.startsWith("/api/mobile") ||
    pathname === "/api/scan_qr" ||
    pathname === "/api/scan_rfid"
  ) {
    const apiKey = request.headers.get("x-api-key");
    const hardwareKey = process.env.HARDWARE_API_KEY;
    const mobileKey = process.env.MOBILE_API_KEY;

    const isValid =
      (hardwareKey && apiKey === hardwareKey) ||
      (mobileKey && apiKey === mobileKey);

    if (!isValid) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing X-API-Key header" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
