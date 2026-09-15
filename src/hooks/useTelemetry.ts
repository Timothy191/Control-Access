"use client";

import { useEffect, useState, useRef } from "react";

export interface TelemetryEvent {
  type?: string;
  timestamp?: string;
  activeTCP?: number;
  totalScans?: number;
  status?: string;
  [key: string]: unknown;
}

export function useTelemetry() {
  const [data, setData] = useState<TelemetryEvent[]>([
    {
      type: "hardware_pulse",
      timestamp: new Date().toISOString(),
      activeTCP: 1,
      status: "live",
    },
  ]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      try {
        eventSource = new EventSource("/api/telemetry");

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (isMounted) {
              setData((prev) => [...prev.slice(-49), parsed]);
            }
          } catch {
            // Keepalive or unparseable
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // Exponential / delayed reconnection
          if (isMounted) {
            reconnectTimeoutRef.current = setTimeout(connect, 4000);
          }
        };
      } catch (err) {
        console.error("Telemetry connect failed:", err);
        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return data;
}
