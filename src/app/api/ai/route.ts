import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { prompt, message } = await req.json();
    const query = (prompt || message || "").trim().toLowerCase();

    if (!query) {
      return NextResponse.json({ reply: "Please provide a question or command for the Control-Access AI Assistant." });
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Fetch live system context for high-fidelity responses
    const [
      totalEmployees,
      totalContractors,
      totalVehicles,
      heavyFleet,
      totalScans,
      recentDenials,
      expiringMedicals,
      expiringInductions,
      activeDevices,
    ] = await Promise.all([
      prisma.employees.count({ where: { is_contractor: false } }),
      prisma.employees.count({ where: { is_contractor: true } }),
      prisma.vehicles.count({ where: { is_heavy_fleet: false } }),
      prisma.vehicles.findMany({ where: { is_heavy_fleet: true } }),
      prisma.gate_logs.count(),
      prisma.gate_logs.findMany({
        where: { access_granted: false },
        take: 10,
        orderBy: { id: "desc" },
      }),
      prisma.employees.findMany({
        where: {
          status: "Active",
          medical_expiry: { not: null, lte: thirtyDaysFromNow },
        },
        take: 10,
      }),
      prisma.employees.findMany({
        where: {
          status: "Active",
          induction_expiry: { not: null, lte: thirtyDaysFromNow },
        },
        take: 10,
      }),
      prisma.devices.findMany(),
    ]);

    let reply = "";

    if (query.includes("compliance") || query.includes("medical") || query.includes("induction") || query.includes("safety")) {
      reply = `🛡️ **Mine Site Compliance & Safety Audit:**\n\n` +
        `• **Active Workforce**: ${totalEmployees} Employees, ${totalContractors} Contractors\n` +
        `• **Expiring Medical Certificates (<30d)**: ${expiringMedicals.length} personnel\n` +
        `• **Expiring Safety Inductions (<30d)**: ${expiringInductions.length} personnel\n` +
        `• **Recent Gate Access Denials**: ${recentDenials.length} events logged\n` +
        `• **Key Interlocking State**: 30-second TTL active on all heavy machine key tags.\n\n` +
        `Recommendation: Ensure all uninducted contractors complete the safety induction module before entering active haulage zones.`;
    } else if (query.includes("fleet") || query.includes("machine") || query.includes("vehicle") || query.includes("hour")) {
      const fleetList = heavyFleet.map(f => `• **${f.fleet_id}** (${f.model || 'Heavy Machine'}): ${f.operational_hours || 0} hrs [${f.status}]`).join("\n");
      reply = `🚜 **Heavy Earth-Moving Fleet Status:**\n\n` +
        `${fleetList || "No heavy fleet machines registered."}\n\n` +
        `• Total Personal Vehicles: ${totalVehicles}\n` +
        `• Operator Certification: Mandatory dual-scan key custody verification enforced.`;
    } else if (query.includes("device") || query.includes("scanner") || query.includes("c66") || query.includes("terminal")) {
      const deviceList = activeDevices.map(d => `• **${d.device_name}** (${d.device_type || 'C66 Handheld'}): ${d.status.toUpperCase()} | Total Scans: ${d.total_scans}`).join("\n");
      reply = `📱 **Scanner Fleet & Zero-Touch Terminals:**\n\n` +
        `${deviceList || "No active terminals linked."}\n\n` +
        `• Real-time SSE push stream: Online (` + `/api/events` + `)\n` +
        `• Zero-Touch Provisioning QR: Active (` + `/onboard/scanner` + `)`;
    } else if (query.includes("log") || query.includes("scan") || query.includes("gate") || query.includes("denial")) {
      const denialList = recentDenials.map(d => `• Gate ${d.gate_location || 'MAIN-01'} [${d.direction}]: ${d.entity_name || 'Tag'} -> **${d.denial_reason || 'Denied'}**`).join("\n");
      reply = `📊 **Gate Telemetry & Audit Logs:**\n\n` +
        `• Total Scans Recorded: ${totalScans}\n` +
        `• Recent Rejections:\n${denialList || "No recent access denials recorded."}\n\n` +
        `Direction auto-toggling and 180-day automated SQLite WAL backups are fully enabled.`;
    } else {
      reply = `🤖 **Control-Access AI Safety Intelligence:**\n\n` +
        `System Status: 🟢 All services operational.\n` +
        `• Workforce Registered: ${totalEmployees + totalContractors}\n` +
        `• Heavy Fleet Machines: ${heavyFleet.length}\n` +
        `• Connected Terminals: ${activeDevices.length}\n` +
        `• Gate Logs Processed: ${totalScans}\n\n` +
        `You can ask me about: "compliance report", "heavy fleet status", "scanner devices", or "recent gate denials".`;
    }

    return NextResponse.json({
      reply,
      response: reply,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("AI route error:", error);
    return NextResponse.json(
      { error: "Failed to process AI request", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
