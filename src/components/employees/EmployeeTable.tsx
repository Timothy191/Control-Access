"use client";

import { useMemo, useState } from "react";

interface Employee {
  id: number;
  emp_code: string;
  first_name: string;
  surname: string;
  job_title: string | null;
  area: string | null;
  status: string;
}

interface EmployeeTableProps {
  employees: Employee[];
  areas: string[];
}

export default function EmployeeTable({
  employees,
  areas,
}: EmployeeTableProps) {
  const [area, setArea] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const areaMatch = area === "all" || (emp.area ?? "") === area;
      const statusMatch = status === "all" || emp.status === status;
      return areaMatch && statusMatch;
    });
  }, [employees, area, status]);

  return (
    <div>
      {/* Filter Area */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Area
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value="all">All Areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            {filtered.length} of {employees.length} employees
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employee Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job Title
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Area
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.map((emp) => (
              <tr key={emp.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {emp.first_name} {emp.surname}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{emp.emp_code}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {emp.job_title || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {emp.area || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${emp.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {emp.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No employees match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
