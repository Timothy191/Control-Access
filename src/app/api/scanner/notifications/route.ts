import { NextResponse } from "next/server";
import {
  subscribeToDeviceNotifications,
  getRecentDeviceNotifications,
  broadcastDeviceNotification,
  type DeviceNotification,
} from "@/lib/device-notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isPoll = url.searchParams.get("poll") === "true";

  // Polling fallback mode
  if (isPoll) {
    const recent = getRecentDeviceNotifications(20);
    return NextResponse.json(recent);
  }

  // Real-time Server-Sent Events (SSE) Stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Handshake initial ping and past recent notifications
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      const past = getRecentDeviceNotifications(5);
      past.reverse().forEach((notif) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(notif)}\n\n`)
        );
      });

      // Keepalive heartbeat
      const heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(heartbeatTimer);
        }
      }, 15000);

      // Subscribe to new real-time notifications
      const unsubscribe = subscribeToDeviceNotifications(
        (notif: DeviceNotification) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(notif)}\n\n`)
            );
          } catch {
            unsubscribe();
            clearInterval(heartbeatTimer);
          }
        }
      );

      // Clean up on disconnect
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeatTimer);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      message,
      type = "ALERT",
      severity = "warning",
      targetDeviceId = "ALL",
      entityName,
      denialReason,
      gateLocation,
      rawTag,
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 }
      );
    }

    const notification = await broadcastDeviceNotification({
      type,
      title,
      message,
      severity,
      targetDeviceId,
      entityName,
      denialReason,
      gateLocation,
      rawTag,
    });

    return NextResponse.json({ success: true, notification });
  } catch (err) {
    console.error("Failed to post device notification:", err);
    return NextResponse.json(
      { error: "Failed to dispatch notification" },
      { status: 500 }
    );
  }
}
