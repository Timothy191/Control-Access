import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

export default async function EmployeesPage() {
  const employees = await prisma.employees.findMany({
    take: 50,
    orderBy: { id: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Employees</h1>
      <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/10">
            <tr>
              <th className="px-6 py-3 font-semibold text-sm">ID</th>
              <th className="px-6 py-3 font-semibold text-sm">Code</th>
              <th className="px-6 py-3 font-semibold text-sm">Name</th>
              <th className="px-6 py-3 font-semibold text-sm">Title</th>
              <th className="px-6 py-3 font-semibold text-sm">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 text-sm">{emp.id}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-400">{emp.emp_code}</td>
                <td className="px-6 py-4 text-sm">{emp.first_name} {emp.surname}</td>
                <td className="px-6 py-4 text-sm">{emp.job_title}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    emp.status === "Active" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
                  }`}>
                    {emp.status || "Unknown"}
                  </span>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
