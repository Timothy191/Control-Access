import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { normalizeSiteName } from "@/lib/sites";
import AccessLogsExplorer, { type LogItem } from "@/components/logs/AccessLogsExplorer";

export const dynamic = "force-dynamic";

export default async function DatabasePage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/database")}`);

  const cookieStore = await cookies();
  const sp = searchParams ? await searchParams : {};
  const rawSite = sp.site || cookieStore.get("selected_site")?.value;
  const site = normalizeSiteName(rawSite);
  const isFiltered = site !== "all";

  const rawLogs = await prisma.gate_logs.findMany({
    where: isFiltered
      ? {
          OR: [
            { gate_location: { contains: site } },
            { employee: { area: { contains: site } } },
          ],
        }
      : {},
    orderBy: { id: "desc" },
    include: {
      employee: true,
      vehicle: true,
      visitor: true,
      equipment: true,
    },
    take: 300,
  });

  const formattedLogs: LogItem[] = rawLogs.map((log) => {
    let meta: Record<string, unknown> = {};
    try {
      if (log.parsed_qr_data) {
        meta = JSON.parse(log.parsed_qr_data);
      }
    } catch {
      // ignore parse error
    }

    const scannedDate = log.scanned_at ? new Date(log.scanned_at) : new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayOfWeek = (meta.day_of_week as string) || dayNames[scannedDate.getDay()];
    const dateString = (meta.date as string) || scannedDate.toISOString().split("T")[0];
    const timeString = (meta.time as string) || scannedDate.toLocaleTimeString();
    const shiftName =
      (meta.shift as string) ||
      (scannedDate.getHours() >= 6 && scannedDate.getHours() < 18 ? "Day Shift" : "Night Shift");

    return {
      id: log.id,
      access_type: log.access_type || "unknown",
      entity_id: log.entity_id,
      entity_name:
        log.employee
          ? `${log.employee.first_name} ${log.employee.surname}`.trim()
          : log.vehicle
          ? `Vehicle ${log.vehicle.fleet_id}`
          : log.visitor
          ? log.visitor.name
          : log.equipment
          ? `Radio ${log.equipment.radio_id}`
          : log.entity_name || "Unknown Entity",
      direction: log.direction || "IN",
      access_granted: log.access_granted,
      denial_reason: log.denial_reason,
      gate_location: log.gate_location || "Central Gate",
      scanned_by: log.scanned_by || "System",
      scanned_at: log.scanned_at ? log.scanned_at.toISOString() : new Date().toISOString(),
      day_of_week: dayOfWeek,
      date: dateString,
      time: timeString,
      shift: shiftName,
      qr_data: log.qr_data,
      employee: log.employee
        ? {
            id: log.employee.id,
            emp_code: log.employee.emp_code,
            name: `${log.employee.first_name} ${log.employee.surname}`.trim(),
            job_title: log.employee.job_title,
            area: log.employee.area,
            status: log.employee.status,
            photo: log.employee.photo,
          }
        : null,
      vehicle: log.vehicle
        ? {
            id: log.vehicle.id,
            fleet_id: log.vehicle.fleet_id,
            status: log.vehicle.status,
          }
        : null,
      visitor: log.visitor
        ? {
            id: log.visitor.id,
            name: log.visitor.name,
            company: log.visitor.company,
            purpose: log.visitor.purpose,
          }
        : null,
      equipment: log.equipment
        ? {
            id: log.equipment.id,
            radio_id: log.equipment.radio_id,
          }
        : null,
      raw_meta: meta,
    };
  });

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <AccessLogsExplorer
        initialLogs={formattedLogs}
        siteFilter={isFiltered ? site : undefined}
      />
    </div>
  );
}
