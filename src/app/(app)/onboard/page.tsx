
import dgram from "node:dgram";
import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import DeviceOnboardingTabs from "@/components/onboard/DeviceOnboardingTabs";
import { getRecentDeviceNotifications } from "@/lib/device-notifications";

function getServerIp(): Promise<string> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    try {
      socket.connect(80, "8.8.8.8", () => {
        const ip = socket.address().address;
        socket.close();
        resolve(ip || "192.168.1.79");
      });
    } catch {
      socket.close();
      resolve("192.168.1.79");
    }
    socket.on("error", () => {
      socket.close();
      resolve("192.168.1.79");
    });
  });
}

import { getTunnelUrl } from "@/lib/tunnel";

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ port?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/onboard")}`);
  }

  const { port } = await searchParams;
  const serverPort = port || "8080";
  let serverIp = await getServerIp();
  if (serverIp === "127.0.0.1" || !serverIp) {
    serverIp = "192.168.1.79";
  }

  const publicUrl = await getTunnelUrl();

  // 1. Generate Universal Permanent Link QR (links C66 permanently to Control-Access)
  const defaultDevice = "Chainway-C66-01";
  const scannerTerminalQr = `${publicUrl}/scanner?link=true&device=${encodeURIComponent(defaultDevice)}`;

  // 2. Generate Infowedge Auto-Config Profile QR
  const configPayload = {
    profile_name: "Plantcor_C66_Config",
    server_ip: serverIp,
    server_port: serverPort,
    api_endpoint: `http://${serverIp}:${serverPort}/api/scanner/receive`,
    public_endpoint: `${publicUrl}/api/scanner/receive`,
    intent_action: "com.rsc.scan.action",
    intent_data_extra: "data",
    timestamp: new Date().toISOString(),
  };
  const infowedgeConfigQr = JSON.stringify(configPayload);

  // 3. Generate Sample Interactive Test Credentials
  const activeTestTagQr = "RFID_EMP_003";
  const deniedTestTagQr = "TEST_UNAUTHORIZED_999";

  // 4. Fetch Registered Devices
  const rawDevices = await prisma.devices.findMany({
    orderBy: { last_seen: "desc" },
    take: 20,
  });

  const devices = rawDevices.map((d) => ({
    id: d.id,
    device_name: d.device_name,
    device_type: d.device_type,
    ip_address: d.ip_address,
    mac_address: d.mac_address,
    last_seen: d.last_seen ? d.last_seen.toISOString() : null,
    status: d.status,
    total_scans: d.total_scans,
  }));

  // 5. Fetch Recent Device Notifications
  const initialNotifications = getRecentDeviceNotifications(20);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
          Device Onboarding & Hardware Management
        </h1>
        <p className="text-xs text-neutral-400 font-sans mt-1">
          Pair Android Chainway C66 Infowedge terminals, dispatch live notifications, and inspect access-denied alerts
        </p>
      </div>

      <DeviceOnboardingTabs
        serverIp={serverIp}
        serverPort={serverPort}
        publicUrl={publicUrl}
        scannerTerminalQr={scannerTerminalQr}
        infowedgeConfigQr={infowedgeConfigQr}
        activeTestTagQr={activeTestTagQr}
        deniedTestTagQr={deniedTestTagQr}
        devices={devices}
        initialNotifications={initialNotifications}
      />
    </div>
  );
}
