import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue("retry: 2000\n\n");

      const sendEvent = (data: unknown) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          // Stream might be closed
        }
      };

      const emitLiveTelemetry = async () => {
        try {
          const [onlineDevices, totalScans] = await Promise.all([
            prisma.devices.count({ where: { status: "online" } }),
            prisma.gate_logs.count(),
          ]);

          sendEvent({
            type: "hardware_pulse",
            timestamp: new Date().toISOString(),
            activeTCP: onlineDevices,
            totalScans,
            status: "live",
          });
        } catch (err) {
          console.error("Telemetry query error:", err);
        }
      };

      // Push immediate live metrics
      await emitLiveTelemetry();

      const interval = setInterval(async () => {
        try {
          await emitLiveTelemetry();
        } catch {
          clearInterval(interval);
        }
      }, 5000);
    },
    cancel() {
      console.log("Telemetry stream disconnected");
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

