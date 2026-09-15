/**
 * Resilient Real-Time Notifications Hook
 * File: src/hooks/useNotifications.ts
 *
 * Provides real-time broadcast and device-targeted notification consumption
 * with automatic exponential backoff reconnection and offline resilience.
 */

"use client";

import { useState, useCallback } from "react";
import { useScanEvents, type SSEConnectionStatus } from "./useScanEvents";
import type { DeviceNotification } from "@/lib/device-notifications";

export interface UseNotificationsOptions {
  deviceId?: string;
  initialLimit?: number;
  filterSeverity?: Array<"danger" | "warning" | "success" | "info">;
}

export function useNotifications({
  deviceId = "ALL",
  initialLimit = 25,
  filterSeverity,
}: UseNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<DeviceNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const handleNotification = useCallback(
    (notif: DeviceNotification) => {
      if (filterSeverity && !filterSeverity.includes(notif.severity)) {
        return;
      }

      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev.slice(0, initialLimit - 1)];
      });
      setUnreadCount((c) => c + 1);
    },
    [filterSeverity, initialLimit]
  );

  const { status, connectionMode, reconnect } = useScanEvents({
    deviceId,
    endpoint: "/api/events",
    onAlert: handleNotification,
    onScanEvent: handleNotification,
    onKeyCustodyEvent: handleNotification,
  });

  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    status: status as SSEConnectionStatus,
    connectionMode,
    markAllAsRead,
    clearNotifications,
    reconnect,
  };
}
