import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  // Fetch summary data directly via Prisma in Server Component
  const [employeeCount, visitorCount, deviceCount] = await Promise.all([
    prisma.employees.count({ where: { status: "Active" } }),
    prisma.visitors.count({ where: { status: "Checked In" } }),
    prisma.devices.count({ where: { status: "online" } }),
  ]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">Active Employees</h2>
          <p className="text-4xl font-bold mt-2">{employeeCount}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">Checked-In Visitors</h2>
          <p className="text-4xl font-bold mt-2">{visitorCount}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <h2 className="text-gray-500 text-sm uppercase font-semibold">Online Devices</h2>
          <p className="text-4xl font-bold mt-2">{deviceCount}</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
      <div className="flex space-x-4">
        <Link href="/employees" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
          View Employees
        </Link>
        <Link href="/visitors" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition">
          Manage Visitors
        </Link>
      </div>
    </div>
  );
}
