"use client";

import { useEffect, useState } from "react";

export function useTelemetry() {
  const [data, setData] = useState<any[]>([]);

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
