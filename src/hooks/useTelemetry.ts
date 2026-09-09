"use client";

import { useEffect, useState } from "react";

export interface TelemetryEvent {
  type?: string;
  timestamp?: string;
  activeTCP?: number;
  [key: string]: unknown;
}

export function useTelemetry() {
  const [data, setData] = useState<TelemetryEvent[]>([]);

  useEffect(() => {
    const eventSource = new EventSource("/api/telemetry");

    eventSource.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      setData((prev) => [...prev.slice(-49), parsed]); // Keep last 50 events
    };

    eventSource.onerror = (error) => {
      console.error("Telemetry SSE Error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return data;
}
