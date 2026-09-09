import prisma from "@/lib/prisma";
import EmployeeTable from "@/components/employees/EmployeeTable";

export default async function EmployeesPage() {
  const employees = await prisma.employees.findMany({
    orderBy: { created_at: "desc" },
  });

  const areas = await prisma.employees.findMany({
    where: { area: { not: null } },
    select: { area: true },
    distinct: ["area"],
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-text-primary">
        Employees ({employees.length})
      </h1>

      <EmployeeTable
        employees={employees}
        areas={areas.map((a) => a.area as string).sort()}
      />
    </div>
  );
}
