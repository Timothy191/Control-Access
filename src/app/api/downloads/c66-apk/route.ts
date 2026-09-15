import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "downloads", "c66-scanner-bridge.apk");

  if (!fs.existsSync(filePath)) {
    return new NextResponse(
      JSON.stringify({
        error: "APK package is currently assembling or not found",
        hint: "Please check back in a moment while the package is generated."
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const stat = fs.statSync(filePath);
  const fileStream = fs.createReadStream(filePath);

  // Convert Node readable stream to Web ReadableStream
  const stream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="c66-scanner-bridge.apk"',
      "Content-Length": stat.size.toString(),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Device-Target": "Chainway-C66-Android",
      "X-Package-Version": "2.1.0-industrial"
    },
  });
}
