"use client";

import { useState } from "react";
import { IconSearch, IconDownload } from "@tabler/icons-react";

export default function GenericTable({
  data,
  tableName,
}: {
  data: Record<string, unknown>[];
  tableName: string;
}) {
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
          <input
            type="text"
            placeholder={`Search ${tableName}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] h-11 pl-10 pr-4 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono placeholder:text-neutral-500 focus:outline-none focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF]/40"
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 active:scale-[0.98] text-neutral-200 text-xs font-mono font-medium rounded-xl transition-all border border-white/15 cursor-pointer shadow-sm"
        >
          <IconDownload size={15} className="text-neutral-400" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#18181b]/80 backdrop-blur-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/60 border-b border-white/10 text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-3.5 whitespace-nowrap font-semibold">
                    {col.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs font-mono text-neutral-300 font-normal">
              {filteredData.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                  {columns.map((col) => {
                    let val = row[col];
                    if (val instanceof Date) {
                      val = val.toLocaleString();
                    } else if (typeof val === 'boolean') {
                      val = val ? "Yes" : "No";
                    }
                    return (
                      <td key={col} className="px-4 py-3 whitespace-nowrap truncate max-w-[220px]" title={String(val)}>
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
