import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import EmployeeTable from "@/components/employees/EmployeeTable";
import { normalizeSiteName } from "@/lib/sites";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string }>;
}) {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/employees")}`);

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

  return (
    <div className="p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-text-primary">
          Employees ({employees.length})
        </h1>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-neutral-300">
          <span className="h-2 w-2 rounded-full bg-red-primary" />
          <span>Site Filter: {isFiltered ? site : "All Sites (Global)"}</span>
        </div>
      </div>

      <EmployeeTable
        employees={employees}
        areas={areas.map((a) => a.area as string).sort()}
      />
    </div>
  );
}
