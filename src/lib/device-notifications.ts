import prisma from "@/lib/prisma";

export interface DeviceNotification {
  id: string;
  timestamp: string;
  type: "ACCESS_DENIED" | "ACCESS_GRANTED" | "ALERT" | "INFO" | "LOCKDOWN";
  title: string;
  message: string;
  targetDeviceId?: string; // "ALL" or specific device ID
  entityName?: string;
  denialReason?: string;
  gateLocation?: string;
  rawTag?: string;
  severity: "danger" | "warning" | "success" | "info";
}

type NotificationListener = (notification: DeviceNotification) => void;

// In-memory global broadcast registry
declare global {
  var __scannerNotificationListeners: Set<NotificationListener> | undefined;
  var __scannerNotificationBuffer: DeviceNotification[] | undefined;
}

if (!globalThis.__scannerNotificationListeners) {
  globalThis.__scannerNotificationListeners = new Set();
}

if (!globalThis.__scannerNotificationBuffer) {
  globalThis.__scannerNotificationBuffer = [];
}

const listeners = globalThis.__scannerNotificationListeners;
const buffer = globalThis.__scannerNotificationBuffer;

export function subscribeToDeviceNotifications(
  listener: NotificationListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRecentDeviceNotifications(limit = 25): DeviceNotification[] {
  return [...buffer].slice(-limit).reverse();
}

export async function broadcastDeviceNotification(
  notificationInput: Omit<DeviceNotification, "id" | "timestamp">
): Promise<DeviceNotification> {
  const notification: DeviceNotification = {
    ...notificationInput,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  // Add to buffer (keep last 50)
  buffer.push(notification);
  if (buffer.length > 50) {
    buffer.shift();
  }

  // Notify all connected SSE client streams
  listeners.forEach((listener) => {
    try {
      listener(notification);
    } catch (e) {
      console.error("Error dispatching notification to listener:", e);
    }
  });

  // Also persist in SQLite notifications table for system audit
  try {
    await prisma.notifications.create({
      data: {
        type: notification.type,
        message: `${notification.title}: ${notification.message}`,
        link: "/onboard",
        read: false,
      },
    });
  } catch (e) {
    console.error("Failed to persist notification in database:", e);
  }

  return notification;
}
