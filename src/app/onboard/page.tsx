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
      <h1 className="text-2xl font-bold mb-2">Device Onboarding</h1>
      <p className="text-gray-500 mb-6">
        Scan a QR code to provision a scanner or download the mobile app.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">
            Total Devices
          </h2>
          <p className="text-4xl font-bold mt-2">{stats.totalDevices}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">
            Active Devices
          </h2>
          <p className="text-4xl font-bold mt-2">{stats.activeDevices}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">
            Total Scans
          </h2>
          <p className="text-4xl font-bold mt-2">{stats.totalScans}</p>
        </div>
      </div>

      {/* QR Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
          <h3 className="text-lg font-medium mb-1">Scanner Config</h3>
          <p className="text-sm text-gray-500 mb-4">
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
          <p className="text-xs text-gray-400 mt-3 break-all">{configUrl}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 text-center">
          <h3 className="text-lg font-medium mb-1">Mobile App Download</h3>
          <p className="text-sm text-gray-500 mb-4">QrMobile.apk</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={appQrImage}
            alt="Mobile app download QR code"
            className="mx-auto"
            width={220}
            height={220}
          />
          <p className="text-xs text-gray-400 mt-3 break-all">
            {appDownloadUrl}
          </p>
        </div>
      </div>

      {/* Recent Devices */}
      <h2 className="text-xl font-bold mb-4">Recent Devices</h2>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Device
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Seen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {recentDevices.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                  No devices registered yet.
                </td>
              </tr>
            ) : (
              recentDevices.map((d) => (
                <tr key={d.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {d.device_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {d.ip_address || d.mac_address || "Unknown"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
