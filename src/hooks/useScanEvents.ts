/**
 * Resilient Real-Time Scan and Key Custody Events Hook
 * File: src/hooks/useScanEvents.ts
 *
 * Implements exponential backoff with jitter, heartbeat watchdog,
 * network status monitoring, and automatic reconnection across
 * mine site Wi-Fi and Cloudflare HTTP/2 proxy tunnels.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { DeviceNotification } from "@/lib/device-notifications";

export type SSEConnectionStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "offline";

export interface UseScanEventsOptions {
  deviceId?: string;
  endpoint?: string;
  onScanEvent?: (event: DeviceNotification) => void;
  onKeyCustodyEvent?: (event: DeviceNotification) => void;
  onAlert?: (event: DeviceNotification) => void;
  autoReconnect?: boolean;
}

export function useScanEvents({
  deviceId = "ALL",
  endpoint = "/api/events",
  onScanEvent,
  onKeyCustodyEvent,
  onAlert,
  autoReconnect = true,
}: UseScanEventsOptions = {}) {
  const [status, setStatus] = useState<SSEConnectionStatus>("connecting");
  const [connectionMode, setConnectionMode] = useState<"LAN" | "Cloudflare">("LAN");
  const [lastEvent, setLastEvent] = useState<DeviceNotification | null>(null);
  const [events, setEvents] = useState<DeviceNotification[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(Date.now());

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchdogTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const connectRef = useRef<() => void>(() => {});
  const scheduleReconnectRef = useRef<() => void>(() => {});

  const cleanupConnection = useCallback(() => {
    if (watchdogTimeoutRef.current) {
      clearTimeout(watchdogTimeoutRef.current);
      watchdogTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Watchdog: detect dead connection if no byte/ping received in 40 seconds
  const resetWatchdog = useCallback(() => {
    if (watchdogTimeoutRef.current) {
      clearTimeout(watchdogTimeoutRef.current);
    }
    watchdogTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      console.warn("[SSE Watchdog] Heartbeat missed for 40s. Forcing reconnect...");
      cleanupConnection();
      scheduleReconnectRef.current();
    }, 40_000);
  }, [cleanupConnection]);

  const scheduleReconnect = useCallback(() => {
    if (!autoReconnect || !isMountedRef.current) return;
    if (reconnectTimeoutRef.current) return;

    setStatus("reconnecting");

    // Exponential backoff with full jitter
    // Base: 1000ms, Factor: 1.5, Max: 30000ms, Jitter: 0-500ms
    const attempt = retryCountRef.current;
    const baseDelay = Math.min(1000 * Math.pow(1.5, attempt), 30_000);
    const jitter = Math.floor(Math.random() * 500);
    const delay = baseDelay + jitter;

    retryCountRef.current = attempt + 1;
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt #${retryCountRef.current})...`);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connectRef.current();
    }, delay);
  }, [autoReconnect]);

  scheduleReconnectRef.current = scheduleReconnect;

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    cleanupConnection();

    if (typeof window !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      return;
    }

    setStatus(retryCountRef.current > 0 ? "reconnecting" : "connecting");

    // Detect connection mode (Cloudflare vs LAN)
    if (typeof window !== "undefined") {
      const isCf =
        window.location.hostname.includes("trycloudflare.com") ||
        window.location.hostname.includes("cloudflare") ||
        window.location.protocol === "https:";
      setConnectionMode(isCf ? "Cloudflare" : "LAN");
    }

    const streamUrl = `${endpoint}?deviceId=${encodeURIComponent(deviceId)}`;
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    resetWatchdog();

    es.onopen = () => {
      if (!isMountedRef.current) return;
      setStatus("connected");
      retryCountRef.current = 0; // Reset backoff counter on successful link
      setLastHeartbeat(Date.now());
      resetWatchdog();
    };

    // Generic notification listener
    es.onmessage = (e) => {
      if (!isMountedRef.current) return;
      resetWatchdog();
      setLastHeartbeat(Date.now());

      try {
        const data = JSON.parse(e.data);
        if (!data || !data.type) return;

        setLastEvent(data);
        setEvents((prev) => [data, ...prev.slice(0, 49)]);

        if (data.type === "KEY_CUSTODY_RESULT") {
          onKeyCustodyEvent?.(data);
        } else if (data.type === "ACCESS_GRANTED" || data.type === "ACCESS_DENIED") {
          onScanEvent?.(data);
        } else {
          onAlert?.(data);
        }
      } catch {
        // ignore non-JSON comment lines
      }
    };

    // Named event: scan
    es.addEventListener("scan", (e: MessageEvent) => {
      if (!isMountedRef.current) return;
      resetWatchdog();
      try {
        const data = JSON.parse(e.data);
        setLastEvent(data);
        onScanEvent?.(data);
      } catch {}
    });

    // Named event: key-custody
    es.addEventListener("key-custody", (e: MessageEvent) => {
      if (!isMountedRef.current) return;
      resetWatchdog();
      try {
        const data = JSON.parse(e.data);
        setLastEvent(data);
        onKeyCustodyEvent?.(data);
      } catch {}
    });

    // Named event: ping / heartbeat
    es.addEventListener("ping", () => {
      if (!isMountedRef.current) return;
      resetWatchdog();
      setLastHeartbeat(Date.now());
    });

    es.onerror = (err) => {
      if (!isMountedRef.current) return;
      console.warn("[SSE Error] Stream connection lost:", err);
      cleanupConnection();
      scheduleReconnect();
    };
  }, [
    deviceId,
    endpoint,
    onScanEvent,
    onKeyCustodyEvent,
    onAlert,
    resetWatchdog,
    cleanupConnection,
    scheduleReconnect,
  ]);

  connectRef.current = connect;

  // Initial connection and teardown
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    // Listen to network online / offline events
    const handleOnline = () => {
      console.log("[SSE] Network restored to ONLINE. Reconnecting immediately...");
      retryCountRef.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      connect();
    };

    const handleOffline = () => {
      console.warn("[SSE] Device OFFLINE.");
      setStatus("offline");
      cleanupConnection();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const timeSinceHeartbeat = Date.now() - lastHeartbeat;
        if (timeSinceHeartbeat > 35_000 || status !== "connected") {
          console.log("[SSE] App resumed from background. Reconnecting stream...");
          connect();
        }
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      cleanupConnection();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connect, cleanupConnection, lastHeartbeat, status]);

  const manualReconnect = useCallback(() => {
    retryCountRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    connect();
  }, [connect]);

  return {
    status,
    connectionMode,
    lastEvent,
    events,
    lastHeartbeat,
    reconnect: manualReconnect,
  };
}
