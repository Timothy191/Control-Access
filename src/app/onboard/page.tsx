import QRCode from "qrcode";
import dgram from "node:dgram";
import prisma from "@/lib/prisma";

function getServerIp(): Promise<string> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    try {
      socket.connect(80, "8.8.8.8", () => {
        const ip = socket.address().address;
        socket.close();
        resolve(ip);
      });
    } catch {
      socket.close();
      resolve("127.0.0.1");
    }
    socket.on("error", () => {
      socket.close();
      resolve("127.0.0.1");
    });
  });
}

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<{ port?: string }>;
}) {
  const { port } = await searchParams;
  const serverPort = port || "8080";
  const serverIp = await getServerIp();

  // Build Config JSON (standard format for mobile auto-config)
  const configPayload = {
    server_ip: serverIp,
    server_port: serverPort,
    api_endpoint: `http://${serverIp}:${serverPort}/api/scanner/receive`,
    api_key: "MINE-CONFIG-ABC-123",
    timestamp: new Date().toISOString(),
  };
  const configJson = JSON.stringify(configPayload);

  const appDownloadUrl = `http://${serverIp}:${serverPort}/downloads/QrMobile.apk`;
  const configUrl = `http://${serverIp}:${serverPort}/api/config/infowedge`;

  const [configQrImage, appQrImage] = await Promise.all([
    QRCode.toDataURL(configJson, { width: 220, margin: 2 }),
    QRCode.toDataURL(appDownloadUrl, { width: 220, margin: 2 }),
  ]);

  // Device stats
  const [totalDevices, activeDevices, totalScansAgg] = await Promise.all([
    prisma.devices.count(),
    prisma.devices.count({ where: { status: "online" } }),
    prisma.devices.aggregate({ _sum: { total_scans: true } }),
  ]);
  const totalScans = totalScansAgg._sum.total_scans ?? 0;

  const recentDevices = await prisma.devices.findMany({
    orderBy: { last_seen: "desc" },
    take: 5,
  });

  const stats = { totalDevices, activeDevices, totalScans };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2 text-text-primary">
        Device Onboarding
      </h1>
      <p className="text-text-secondary mb-6">
        Scan a QR code to provision a scanner or download the mobile app.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card">
          <h2 className="text-text-secondary text-sm uppercase font-semibold">
            Total Devices
          </h2>
          <p className="text-4xl font-bold mt-2 text-text-primary">
            {stats.totalDevices}
          </p>
        </div>
        <div className="glass-card">
          <h2 className="text-text-secondary text-sm uppercase font-semibold">
            Active Devices
          </h2>
          <p className="text-4xl font-bold mt-2 text-text-primary">
            {stats.activeDevices}
          </p>
        </div>
        <div className="glass-card">
          <h2 className="text-text-secondary text-sm uppercase font-semibold">
            Total Scans
          </h2>
          <p className="text-4xl font-bold mt-2 text-text-primary">
            {stats.totalScans}
          </p>
        </div>
      </div>

      {/* QR Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="glass-card text-center">
          <h3 className="text-lg font-medium mb-1 text-text-primary">
            Scanner Config
          </h3>
          <p className="text-sm text-text-secondary mb-4">
            {serverIp}:{serverPort}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={configQrImage}
            alt="Scanner configuration QR code"
            className="mx-auto"
            width={220}
            height={220}
          />
          <p className="text-xs text-text-secondary mt-3 break-all">
            {configUrl}
          </p>
        </div>

        <div className="glass-card text-center">
          <h3 className="text-lg font-medium mb-1 text-text-primary">
            Mobile App Download
          </h3>
          <p className="text-sm text-text-secondary mb-4">QrMobile.apk</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={appQrImage}
            alt="Mobile app download QR code"
            className="mx-auto"
            width={220}
            height={220}
          />
          <p className="text-xs text-text-secondary mt-3 break-all">
            {appDownloadUrl}
          </p>
        </div>
      </div>

      {/* Recent Devices */}
      <h2 className="text-xl font-bold mb-4 text-text-primary">
        Recent Devices
      </h2>
      <div className="glass-table overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Device</th>
              <th>Address</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {recentDevices.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-4 text-center text-text-secondary"
                >
                  No devices registered yet.
                </td>
              </tr>
            ) : (
              recentDevices.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap">{d.device_name}</td>
                  <td className="whitespace-nowrap font-mono text-sm">
                    {d.ip_address || d.mac_address || "Unknown"}
                  </td>
                  <td className="whitespace-nowrap">
                    {d.last_seen
                      ? new Date(d.last_seen).toLocaleTimeString()
                      : "Never"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
