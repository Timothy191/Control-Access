import { NextResponse } from "next/server";

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue("retry: 1000\n\n");
      
      const sendEvent = (data: any) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Mocking Redis pub/sub telemetry events for SSE
      const interval = setInterval(() => {
        try {
          sendEvent({
            type: "ping",
            timestamp: new Date().toISOString(),
            activeTCP: Math.floor(Math.random() * 10),
          });
        } catch (error) {
          clearInterval(interval);
        }
      }, 5000);
    },
    cancel() {
      // Clean up when the client disconnects
      console.log("Telemetry stream disconnected");
    }
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
