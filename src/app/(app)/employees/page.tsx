import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { normalizeSiteName } from "@/lib/sites";
import {
  IconUsers,
  IconBuilding,
  IconAlertTriangle,
  IconShieldX,
} from "@tabler/icons-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/employees")}`);
  }

  const cookieStore = await cookies();
  const sp = searchParams ? await searchParams : {};
  const rawSite = sp.site || cookieStore.get("selected_site")?.value;
  const site = normalizeSiteName(rawSite);
  const isFiltered = site !== "all";

  const employees = await prisma.employees.findMany({
    where: isFiltered ? { area: { contains: site } } : {},
    orderBy: { created_at: "desc" },
  });

  const areas = await prisma.employees.findMany({
    where: { area: { not: null } },
    select: { area: true },
    distinct: ["area"],
  });

  // Calculate high-level compliance telemetry for the summary strip
  const now = new Date();
  let totalContractors = 0;
  let totalMineEmployees = 0;
  let expiringSoonCount = 0;
  let nonCompliantCount = 0;
  const contractorCompanies = new Set<string>();

  for (const emp of employees) {
    const isContractor = Boolean(
      emp.is_contractor ||
      (emp.contractor_company && emp.contractor_company.trim().length > 0) ||
      (emp.job_title && /contractor/i.test(emp.job_title))
    );

    if (isContractor) {
      totalContractors++;
      if (emp.contractor_company?.trim()) {
        contractorCompanies.add(emp.contractor_company.trim());
      }
    } else {
      totalMineEmployees++;
    }

    let isBlocked = false;
    let isWarning = false;

    // Evaluate Account Status
    if (emp.status !== "Active") {
      isBlocked = true;
    }

    // Evaluate Medical Expiry
    if (!emp.medical_expiry) {
      isBlocked = true;
    } else {
      const medDiff = Math.ceil(
        (new Date(emp.medical_expiry).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (medDiff < 0) isBlocked = true;
      else if (medDiff <= 30) isWarning = true;
    }

    // Evaluate Induction Expiry
    if (isContractor && (!emp.induction?.trim() || !emp.induction_expiry)) {
      isBlocked = true;
    } else if (!emp.induction_expiry) {
      isBlocked = true;
    } else {
      const indDiff = Math.ceil(
        (new Date(emp.induction_expiry).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (indDiff < 0) isBlocked = true;
      else if (indDiff <= 30) isWarning = true;
    }

    if (isBlocked) {
      nonCompliantCount++;
    } else if (isWarning) {
      expiringSoonCount++;
    }
  }

  // Extract distinct access levels
  const accessLevels = Array.from(
    new Set(
      employees
        .map((e) => e.access_level?.trim())
        .filter((val): val is string => Boolean(val && val.length > 0))
    )
  ).sort();

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-screen-2xl mx-auto">
      {/* Header and Context Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <span>Workforce &amp; Contractor Register</span>
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-3xl">
            Unified personnel directory tracking direct mine staff and third-party
            contractors, safety induction expiries, medical fitness countdowns,
            and automated gate clearance status.
          </p>
        </div>

        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-mono text-neutral-300 backdrop-blur-md shadow-inner">
          <span className="h-2.5 w-2.5 rounded-full bg-[#007AFF] shadow-[0_0_8px_rgba(0,122,255,0.8)] animate-pulse" />
          <span>Site Filter: {isFiltered ? site : "All Sites (Global)"}</span>
        </div>
      </div>

      {/* Overview Telemetry KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Workforce */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#141418]/80 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
              Total Workforce
            </span>
            <div className="text-2xl font-bold font-mono text-white">
              {employees.length}
            </div>
            <span className="text-[11px] text-neutral-400 block font-mono">
              {totalMineEmployees} Mine Staff • {totalContractors} Contractors
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-[#007AFF]/15 text-[#007AFF] border border-[#007AFF]/30 flex items-center justify-center">
            <IconUsers size={24} />
          </div>
        </div>

        {/* Third-Party Contractors */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#141418]/80 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
              Contractors
            </span>
            <div className="text-2xl font-bold font-mono text-amber-300">
              {totalContractors}
            </div>
            <span className="text-[11px] text-neutral-400 block font-mono">
              {contractorCompanies.size} Contracting {contractorCompanies.size === 1 ? "Company" : "Companies"}
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <IconBuilding size={24} />
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#141418]/80 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
              Expiring Soon (&le; 30d)
            </span>
            <div className="text-2xl font-bold font-mono text-yellow-300">
              {expiringSoonCount}
            </div>
            <span className="text-[11px] text-neutral-400 block font-mono">
              Medical or Induction Renewal Due
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center justify-center">
            <IconAlertTriangle size={24} />
          </div>
        </div>

        {/* Access Blocked / Non-Compliant */}
        <div className="p-4 rounded-2xl border border-white/10 bg-[#141418]/80 backdrop-blur-xl shadow-lg flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">
              Access Blocked
            </span>
            <div className="text-2xl font-bold font-mono text-red-400">
              {nonCompliantCount}
            </div>
            <span className="text-[11px] text-neutral-400 block font-mono">
              Immediate Gate Refusal Risk
            </span>
          </div>
          <div className="h-12 w-12 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center">
            <IconShieldX size={24} />
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <EmployeeTable
        employees={employees}
        areas={areas.map((a) => a.area as string).sort()}
        accessLevels={accessLevels}
      />
    </div>
  );
}
