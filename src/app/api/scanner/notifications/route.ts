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
  const clientDeviceId = url.searchParams.get("deviceId") || url.searchParams.get("device");
  const sendPast = url.searchParams.get("history") === "true";

  // Polling fallback mode
  if (isPoll) {
    let recent = getRecentDeviceNotifications(25);
    if (clientDeviceId && clientDeviceId !== "ALL") {
      recent = recent.filter(
        (n) =>
          !n.targetDeviceId ||
          n.targetDeviceId === "ALL" ||
          n.targetDeviceId.toLowerCase() === clientDeviceId.toLowerCase()
      );
    }
    return NextResponse.json(recent);
  }

  // Real-time Server-Sent Events (SSE) Stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Handshake initial ping and client identity confirmation
      controller.enqueue(encoder.encode("retry: 2000\n\n"));
      controller.enqueue(
        encoder.encode(
          `event: ready\ndata: ${JSON.stringify({
            status: "connected",
            clientDeviceId: clientDeviceId || "ALL",
            timestamp: new Date().toISOString(),
          })}\n\n`
        )
      );

      // Only send past notifications if explicitly requested (avoids re-triggering alarms on page load)
      if (sendPast) {
        const past = getRecentDeviceNotifications(5);
        past.reverse().forEach((notif) => {
          if (
            !clientDeviceId ||
            clientDeviceId === "ALL" ||
            !notif.targetDeviceId ||
            notif.targetDeviceId === "ALL" ||
            notif.targetDeviceId.toLowerCase() === clientDeviceId.toLowerCase()
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ ...notif, isHistorical: true })}\n\n`
              )
            );
          }
        });
      }

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
          const matchesTarget =
            !clientDeviceId ||
            clientDeviceId === "ALL" ||
            !notif.targetDeviceId ||
            notif.targetDeviceId === "ALL" ||
            notif.targetDeviceId.toLowerCase() === clientDeviceId.toLowerCase();

          if (matchesTarget) {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(notif)}\n\n`)
              );
            } catch {
              unsubscribe();
              clearInterval(heartbeatTimer);
            }
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
