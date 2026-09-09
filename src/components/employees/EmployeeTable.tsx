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
      <div className="glass-card mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
              Area
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="px-3 py-2 border border-steel/30 rounded-md bg-black/40 text-text-primary text-sm"
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
            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-steel/30 rounded-md bg-black/40 text-text-primary text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="text-sm text-text-secondary">
            {filtered.length} of {employees.length} employees
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-table">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Employee Code</th>
              <th>Job Title</th>
              <th>Area</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.id}>
                <td className="whitespace-nowrap">
                  {emp.first_name} {emp.surname}
                </td>
                <td className="whitespace-nowrap font-mono text-sm">
                  {emp.emp_code}
                </td>
                <td className="whitespace-nowrap">{emp.job_title || "-"}</td>
                <td className="whitespace-nowrap">{emp.area || "-"}</td>
                <td className="whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                      emp.status === "Active"
                        ? "bg-success/20 text-success border-success/30"
                        : "bg-danger/20 text-danger border-danger/30"
                    }`}
                  >
                    {emp.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-8 text-center text-text-secondary"
                >
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
