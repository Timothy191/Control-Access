/**
 * Resilient Real-Time Server-Sent Events (SSE) Bus Route
 * File: src/app/api/events/route.ts
 *
 * Implements Cloudflare HTTP/2 proxy keepalive (: ping\n\n every 15s),
 * initial comment buffer flush, device-targeted push routing,
 * and dual event/data payload delivery for mine site scanners and dashboards.
 */

import { NextResponse } from "next/server";
import {
  subscribeToDeviceNotifications,
  getRecentDeviceNotifications,
  broadcastDeviceNotification,
  type DeviceNotification,
} from "@/lib/device-notifications";
import { getTunnelUrl } from "@/lib/tunnel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const clientDeviceId =
    url.searchParams.get("deviceId") ||
    url.searchParams.get("device") ||
    "ALL";
  const sendPast = url.searchParams.get("history") === "true";
  const isPoll = url.searchParams.get("poll") === "true";

  // Polling fallback mode for legacy / restricted network environments
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

  // Real-time Server-Sent Events Stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      const safeEnqueue = (chunk: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          isClosed = true;
        }
      };

      // 1. Initial 2KB Comment Padding to bypass Cloudflare / Nginx proxy buffering
      // Guarantees immediate HTTP/2 chunk delivery to clients over remote tunnels.
      safeEnqueue(`: ${" ".repeat(2048)}\n\n`);

      // 2. Client Auto-Reconnect Interval Instruction (SSE standard)
      safeEnqueue("retry: 2500\n\n");

      // 3. Handshake Ready Event
      let tunnelUrl = "http://127.0.0.1:8080";
      try {
        tunnelUrl = await getTunnelUrl();
      } catch {
        // use fallback
      }

      safeEnqueue(
        `event: ready\ndata: ${JSON.stringify({
          status: "connected",
          clientDeviceId,
          tunnelUrl,
          timestamp: new Date().toISOString(),
          heartbeatIntervalMs: 15000,
        })}\n\n`
      );

      // 4. Send Recent Event History if Requested
      if (sendPast) {
        const past = getRecentDeviceNotifications(5);
        past.reverse().forEach((notif) => {
          const isForClient =
            clientDeviceId === "ALL" ||
            !notif.targetDeviceId ||
            notif.targetDeviceId === "ALL" ||
            notif.targetDeviceId.toLowerCase() === clientDeviceId.toLowerCase();

          if (isForClient) {
            safeEnqueue(`event: alert\ndata: ${JSON.stringify({ ...notif, isHistorical: true })}\n\n`);
          }
        });
      }

      // 5. Periodic Keepalive Ping (: ping\n\n) every 15 seconds
      // Prevents Cloudflare 100s proxy timeout (HTTP 524) and cellular NAT connection drops.
      const heartbeatTimer = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatTimer);
          return;
        }
        // SSE comment line — ignored by EventSource onmessage, but resets proxy idle timers
        safeEnqueue(": ping\n\n");
        // Also emit heartbeat event for clients with explicit latency watchdogs
        safeEnqueue(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
      }, 15000);

      // 6. Subscribe to System-Wide Broadcast Bus (Scans, Key Custody, Denials)
      const unsubscribe = subscribeToDeviceNotifications(
        (notif: DeviceNotification) => {
          if (isClosed) return;

          const matchesTarget =
            clientDeviceId === "ALL" ||
            !notif.targetDeviceId ||
            notif.targetDeviceId === "ALL" ||
            notif.targetDeviceId.toLowerCase() === clientDeviceId.toLowerCase();

          if (!matchesTarget) return;

          // Determine semantic event name
          let eventName = "alert";
          if (notif.type === "KEY_CUSTODY_RESULT") {
            eventName = "key-custody";
          } else if (notif.type === "ACCESS_GRANTED" || notif.type === "ACCESS_DENIED") {
            eventName = "scan";
          }

          // Emit named event AND generic data message for universal compatibility
          safeEnqueue(`event: ${eventName}\ndata: ${JSON.stringify(notif)}\n\n`);
          safeEnqueue(`data: ${JSON.stringify(notif)}\n\n`);
        }
      );

      // 7. Cleanup Resources on Stream Abort or Disconnect
      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
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
    console.error("Events API POST error:", err);
    return NextResponse.json(
      { error: "Failed to dispatch event" },
      { status: 500 }
    );
  }
}
