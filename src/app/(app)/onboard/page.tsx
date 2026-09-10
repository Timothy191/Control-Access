import QRCode from "qrcode";
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

async function getPublicUrl(): Promise<string> {
  try {
    const txtPath = path.join(process.cwd(), "public_url.txt");
    const content = (await fs.readFile(txtPath, "utf-8")).trim();
    if (content.startsWith("http")) return content;
  } catch {
    // fallback
  }
  return "https://francisco-wing-appointment-gap.trycloudflare.com";
}

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

  const publicUrl = await getPublicUrl();

  // 1. Generate Terminal Pairing QR (opens C66 terminal in browser)
  const terminalUrl = `http://${serverIp}:${serverPort}/onboard/scanner`;
  const scannerTerminalQr = await QRCode.toDataURL(terminalUrl, {
    width: 260,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

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
  const infowedgeConfigQr = await QRCode.toDataURL(
    JSON.stringify(configPayload),
    {
      width: 260,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }
  );

  // 3. Generate Sample Interactive Test Credentials
  const [activeTestTagQr, deniedTestTagQr] = await Promise.all([
    QRCode.toDataURL("RFID_EMP_003", { width: 140, margin: 1 }),
    QRCode.toDataURL("TEST_UNAUTHORIZED_999", { width: 140, margin: 1 }),
  ]);

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
