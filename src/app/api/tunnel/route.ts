import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const jsonPath = path.join(process.cwd(), "tunnel_info.json");
    const txtPath = path.join(process.cwd(), "public_url.txt");

    try {
      const data = await fs.readFile(jsonPath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    } catch {
      const url = (await fs.readFile(txtPath, "utf-8")).trim();
      return NextResponse.json({
        public_url: url,
        provider: "cloudflare",
        active: true,
      });
    }
  } catch {
    return NextResponse.json({
      public_url: "https://francisco-wing-appointment-gap.trycloudflare.com",
      provider: "cloudflare",
      active: true,
    });
  }
}
