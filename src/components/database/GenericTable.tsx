"use client";

import { useState } from "react";
import { IconSearch, IconDownload } from "@tabler/icons-react";

export default function GenericTable({ data, tableName }: { data: any[]; tableName: string }) {
  const [search, setSearch] = useState("");

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-neutral-400 font-mono text-sm bg-neutral-900/50 rounded-xl border border-white/10">
        No records found in {tableName}
      </div>
    );
  }

  const columns = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');

  const filteredData = data.filter((row) =>
    columns.some((col) => {
      const val = row[col];
      return val && String(val).toLowerCase().includes(search.toLowerCase());
    })
  );

  const handleExport = () => {
    const csvRows = [];
    csvRows.push(columns.join(","));
    filteredData.forEach((row) => {
      const values = columns.map((col) => {
        const val = row[col];
        const stringVal = val === null || val === undefined ? "" : String(val);
        return `"${stringVal.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableName}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm w-full">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
          <input
            type="text"
            placeholder={`Search ${tableName}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-neutral-900 border border-white/10 text-sm text-white font-mono placeholder:text-neutral-600 focus:outline-none focus:border-[#007AFF]"
          />
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono font-medium rounded-lg transition-colors border border-white/10"
        >
          <IconDownload size={14} />
          Export CSV
        </button>
      </div>

      <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/40 border-b border-white/10">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-3 text-xs font-mono text-neutral-400 uppercase whitespace-nowrap">
                    {col.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm font-mono text-neutral-300">
              {filteredData.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                  {columns.map((col) => {
                    let val = row[col];
                    if (val instanceof Date) {
                      val = val.toLocaleString();
                    } else if (typeof val === 'boolean') {
                      val = val ? "Yes" : "No";
                    }
                    return (
                      <td key={col} className="px-4 py-2.5 whitespace-nowrap truncate max-w-[200px]" title={String(val)}>
                        {val === null || val === undefined ? <span className="text-neutral-600">-</span> : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
