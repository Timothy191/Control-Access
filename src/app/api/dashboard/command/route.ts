import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const lockdownSetting = await prisma.site_settings.findUnique({
      where: { key: "system_lockdown" },
    });
    const reasonSetting = await prisma.site_settings.findUnique({
      where: { key: "lockdown_reason" },
    });
    const timeSetting = await prisma.site_settings.findUnique({
      where: { key: "lockdown_timestamp" },
    });

    // Fetch distinct gates from gate_logs
    const distinctGates = await prisma.gate_logs.findMany({
      where: {
        gate_location: { not: null },
      },
      select: { gate_location: true },
      distinct: ["gate_location"],
      take: 20,
    });

    const gates = distinctGates
      .map((g) => g.gate_location)
      .filter((g): g is string => typeof g === "string" && g.trim().length > 0);

    const defaultGates = [
      "Brakfontein - Main Gate",
      "Thando Tech - Remote Turnstile",
      "Optimum - Port 9100",
      "Brakfontein - North Pit Portal",
      "Head Office - Mobile Terminal",
    ];

    const allGates = Array.from(new Set([...gates, ...defaultGates]));

    return NextResponse.json({
      lockdown: lockdownSetting?.value === "true",
      lockdownReason: reasonSetting?.value || "Security Protocol Enforced",
      lockdownStartedAt: timeSetting?.value || null,
      gates: allGates,
    });
  } catch (err) {
    console.error("Error fetching command status:", err);
    return NextResponse.json(
      { error: "Failed to fetch command status" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, lockdown, reason, gate, durationSeconds, operator } = body;

    if (action === "TOGGLE_LOCKDOWN") {
      const isLockdown = Boolean(lockdown);
      const timestamp = new Date().toISOString();

      await prisma.site_settings.upsert({
        where: { key: "system_lockdown" },
        update: { value: isLockdown ? "true" : "false" },
        create: { key: "system_lockdown", value: isLockdown ? "true" : "false" },
      });

      if (isLockdown) {
        await prisma.site_settings.upsert({
          where: { key: "lockdown_reason" },
          update: { value: reason || "Emergency Protocol Activated" },
          create: { key: "lockdown_reason", value: reason || "Emergency Protocol Activated" },
        });
        await prisma.site_settings.upsert({
          where: { key: "lockdown_timestamp" },
          update: { value: timestamp },
          create: { key: "lockdown_timestamp", value: timestamp },
        });

        // Log a security event to gate_logs
        await prisma.gate_logs.create({
          data: {
            access_type: "SECURITY_LOCKDOWN",
            entity_name: "SYSTEM ALERT: PERIMETER RESTRICTION",
            direction: "LOCKDOWN",
            access_granted: false,
            denial_reason: `SITE LOCKDOWN INITIATED: ${reason || "Emergency Protocol Activated"}`,
            gate_location: "ALL GATES & BARRIERS",
            scanned_by: operator || "Command Console",
          },
        });
      } else {
        // Clear lockdown reason
        await prisma.site_settings.upsert({
          where: { key: "lockdown_reason" },
          update: { value: "" },
          create: { key: "lockdown_reason", value: "" },
        });

        // Log security release to gate_logs
        await prisma.gate_logs.create({
          data: {
            access_type: "SECURITY_NORMAL",
            entity_name: "SYSTEM ALERT: LOCKDOWN CLEARED",
            direction: "RESTORE",
            access_granted: true,
            denial_reason: `Perimeter returned to normal operations by ${operator || "Operator"}`,
            gate_location: "ALL GATES & BARRIERS",
            scanned_by: operator || "Command Console",
          },
        });
      }

      return NextResponse.json({
        success: true,
        lockdown: isLockdown,
        lockdownReason: isLockdown ? reason || "Emergency Protocol Activated" : "",
        lockdownStartedAt: isLockdown ? timestamp : null,
      });
    }

    if (action === "GATE_OVERRIDE") {
      if (!gate) {
        return NextResponse.json({ error: "Missing gate parameter" }, { status: 400 });
      }

      const dur = durationSeconds || 15;
      const overrideReason = reason || "Authorized Operator Override";

      // Log the override in gate_logs
      const log = await prisma.gate_logs.create({
        data: {
          access_type: "GATE_OVERRIDE",
          entity_name: `Manual Override Pulse (${dur}s)`,
          direction: "OVERRIDE",
          access_granted: true,
          denial_reason: `Unlocked for ${dur}s: ${overrideReason}`,
          gate_location: gate,
          scanned_by: operator || "Command Console",
        },
      });

      return NextResponse.json({
        success: true,
        message: `Override pulse sent to ${gate} (${dur}s)`,
        logId: log.id,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Error executing command:", err);
    return NextResponse.json(
      { error: "Failed to execute command action" },
      { status: 500 }
    );
  }
}
