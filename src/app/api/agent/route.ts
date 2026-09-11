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

    // Escape single quotes to prevent shell injection, then wrap in single quotes
    const safePrompt = prompt.replace(/'/g, "'\\''");
    
    // Execute Antigravity CLI natively on the server
    const { stdout, stderr } = await execAsync(`agy --print '${safePrompt}'`);

    if (stderr && !stdout) {
      console.warn("AGY Stderr:", stderr);
    }

    return NextResponse.json({ response: stdout || stderr || "No response generated." });
  } catch (error: any) {
    console.error("AGY Execution Error:", error);
    return NextResponse.json({ 
      error: "Failed to communicate with Antigravity Agent", 
      details: error.message 
    }, { status: 500 });
  }
}
