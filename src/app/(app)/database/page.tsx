import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { normalizeSiteName } from "@/lib/sites";
import AccessLogsExplorer, { type LogItem } from "@/components/logs/AccessLogsExplorer";
import GenericTable from "@/components/database/GenericTable";
import {
  IconClipboardList,
  IconUsers,
  IconUser,
  IconTruck,
  IconTool,
  IconDeviceMobile,
  IconSettings
} from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export default async function DatabasePage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string; table?: string }>;
}) {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/database")}`);

  const cookieStore = await cookies();
  const sp = searchParams ? await searchParams : {};
  const rawSite = sp.site || cookieStore.get("selected_site")?.value;
  const site = normalizeSiteName(rawSite);
  const isFiltered = site !== "all";

  const currentTab = sp.table || "gate_logs";

  const tabs = [
    { id: "gate_logs", name: "Gate Logs", icon: IconClipboardList },
    { id: "employees", name: "Employees", icon: IconUsers },
    { id: "visitors", name: "Visitors", icon: IconUser },
    { id: "vehicles", name: "Vehicles", icon: IconTruck },
    { id: "equipment", name: "Equipment", icon: IconTool },
    { id: "devices", name: "Devices", icon: IconDeviceMobile },
    { id: "site_settings", name: "Settings", icon: IconSettings },
  ];

  let tableContent = null;

  if (currentTab === "gate_logs") {
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

    tableContent = (
      <AccessLogsExplorer
        initialLogs={formattedLogs}
        siteFilter={isFiltered ? site : undefined}
      />
    );
  } else if (currentTab === "employees") {
    const data = await prisma.employees.findMany({ take: 300, orderBy: { id: "desc" } });
    tableContent = <GenericTable data={data} tableName="Employees" />;
  } else if (currentTab === "visitors") {
    const data = await prisma.visitors.findMany({ take: 300, orderBy: { id: "desc" } });
    tableContent = <GenericTable data={data} tableName="Visitors" />;
  } else if (currentTab === "vehicles") {
    const data = await prisma.vehicles.findMany({ take: 300, orderBy: { id: "desc" } });
    tableContent = <GenericTable data={data} tableName="Vehicles" />;
  } else if (currentTab === "equipment") {
    const data = await prisma.equipment.findMany({ take: 300, orderBy: { id: "desc" } });
    tableContent = <GenericTable data={data} tableName="Equipment" />;
  } else if (currentTab === "devices") {
    const data = await prisma.devices.findMany({ take: 300, orderBy: { id: "desc" } });
    tableContent = <GenericTable data={data} tableName="Devices" />;
  } else if (currentTab === "site_settings") {
    const data = await prisma.site_settings.findMany({ take: 300, orderBy: { id: "desc" } });
    tableContent = <GenericTable data={data} tableName="Site Settings" />;
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-sans tracking-tight">Database Explorer</h1>
          <p className="text-sm text-neutral-400 font-mono mt-1">
            Raw data viewer and management console
          </p>
        </div>
      </div>

      {/* Header Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar border-b border-white/10">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={`/database?table=${tab.id}${site ? `&site=${site}` : ''}`}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-[#007AFF] text-white bg-white/5"
                  : "border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.02]"
              }`}
            >
              <tab.icon size={16} />
              {tab.name}
            </Link>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {tableContent}
      </div>
    </div>
  );
}
