import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    return NextResponse.json({ reply: `Echo from AI Assistant: You said "${message}"` });
  } catch (error) {
    return NextResponse.json({ error: "Failed to process AI request" }, { status: 500 });
  }
}
