import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Escape single quotes to prevent shell injection, though user input should be sanitized
    const safePrompt = prompt.replace(/'/g, "'\\''");
    
    // Utilize the antigravity CLI on the backend as requested
    const { stdout, stderr } = await execAsync(`agy --print '${safePrompt}'`);

    if (stderr && !stdout) {
      console.error("AGY CLI Error:", stderr);
    }

    return NextResponse.json({ response: stdout.trim() });
  } catch (error: any) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: "Failed to generate response", details: error.message }, { status: 500 });
  }
}
