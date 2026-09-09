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
      <h1 className="text-2xl font-bold mb-4">
        Database / Gate Logs ({logs.length})
      </h1>

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Photo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name &amp; Surname
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Id Number
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Job Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Area
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Medical Expiry
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Induction Expiry
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                QR-Code
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location / Site
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time Scanned
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Direction
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Alcohol Tested
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
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
                  <td className="px-4 py-3 whitespace-nowrap">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-semibold">
                        {name
                          .split(/\s+/)
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">
                    {name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {idNumber || "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {emp?.job_title || "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {emp?.area || "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fmtDate(emp?.medical_expiry)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fmtDate(emp?.induction_expiry)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                    {qrCode}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {log.gate_location || "Main Gate"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {fmtTime(log.scanned_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono ${log.direction === "IN" ? "bg-blue-100 text-blue-800" : log.direction === "OUT" ? "bg-orange-100 text-orange-800" : "bg-gray-100 text-gray-700"}`}
                    >
                      {log.direction || "SCAN"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${log.access_granted ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                    >
                      {log.access_granted
                        ? "GRANTED"
                        : log.denial_reason || "DENIED"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {log.alcohol_tested || "-"}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={13}
                  className="px-6 py-8 text-center text-gray-500"
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
