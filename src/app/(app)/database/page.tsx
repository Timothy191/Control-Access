import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString();
}

function fmtTime(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString();
}

export default async function DatabasePage() {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/database")}`);

  const logs = await prisma.gate_logs.findMany({
    orderBy: { id: "desc" },
    include: { employee: true },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-text-primary">
        Database / Gate Logs ({logs.length})
      </h1>

      <div className="glass-table overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Name &amp; Surname</th>
              <th>Id Number</th>
              <th>Job Title</th>
              <th>Area</th>
              <th>Medical Expiry</th>
              <th>Induction Expiry</th>
              <th>QR-Code</th>
              <th>Location / Site</th>
              <th>Time Scanned</th>
              <th>Direction</th>
              <th>Status</th>
              <th>Alcohol Tested</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const emp = log.employee;
              const name = emp
                ? `${emp.first_name} ${emp.surname}`.trim()
                : log.entity_name || "Unknown";
              const idNumber = emp ? decryptField(emp.id_number) : null;
              const qrCode = emp?.qr_code || log.qr_data || "-";
              const photo = emp?.photo || null;

              return (
                <tr key={log.id}>
                  <td className="whitespace-nowrap">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-text-secondary text-xs font-semibold">
                        {name
                          .split(/\s+/)
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap font-medium">{name}</td>
                  <td className="whitespace-nowrap font-mono text-sm">
                    {idNumber || "-"}
                  </td>
                  <td className="whitespace-nowrap">{emp?.job_title || "-"}</td>
                  <td className="whitespace-nowrap">{emp?.area || "-"}</td>
                  <td className="whitespace-nowrap">
                    {fmtDate(emp?.medical_expiry)}
                  </td>
                  <td className="whitespace-nowrap">
                    {fmtDate(emp?.induction_expiry)}
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {qrCode}
                  </td>
                  <td className="whitespace-nowrap">
                    {log.gate_location || "Main Gate"}
                  </td>
                  <td className="whitespace-nowrap">
                    {fmtTime(log.scanned_at)}
                  </td>
                  <td className="whitespace-nowrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono border ${
                        log.direction === "IN"
                          ? "bg-red-primary/20 text-red-primary border-red-primary/30"
                          : log.direction === "OUT"
                            ? "bg-warning/20 text-warning border-warning/30"
                            : "bg-white/10 text-text-secondary border-white/10"
                      }`}
                    >
                      {log.direction || "SCAN"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                        log.access_granted
                          ? "bg-success/20 text-success border-success/30"
                          : "bg-danger/20 text-danger border-danger/30"
                      }`}
                    >
                      {log.access_granted
                        ? "GRANTED"
                        : log.denial_reason || "DENIED"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {log.alcohol_tested || "-"}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={13}
                  className="px-6 py-8 text-center text-text-secondary"
                >
                  No gate scan records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
