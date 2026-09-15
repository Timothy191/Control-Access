import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import AdminZeroTouchSection from "@/components/admin/AdminZeroTouchSection";
import { getTunnelUrl } from "@/lib/tunnel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/admin")}`);
  if (session.user.role !== "admin") redirect("/");

  const users = await prisma.users.findMany({
    orderBy: { created_at: "desc" },
  });

  const tunnelUrl = await getTunnelUrl();
  const serverUrl = process.env.BASE_URL || "http://127.0.0.1:8080";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">
        System Administration &amp; Security Controls
      </h1>

      {/* Zero-Touch Provisioning Section */}
      <AdminZeroTouchSection
        serverUrl={serverUrl}
        tunnelUrl={tunnelUrl}
        defaultGate="GATE-MAIN-01"
      />

      {/* System Users Table */}
      <div className="glass-card space-y-4">
        <h2 className="text-lg font-semibold text-white tracking-tight">
          System Users &amp; Roles ({users.length})
        </h2>
        <div className="glass-table overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 bg-black/60 text-[10px] uppercase text-neutral-400">
                <th className="p-3.5">Username</th>
                <th className="p-3.5">System Role</th>
                <th className="p-3.5">MFA Status</th>
                <th className="p-3.5">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.02] transition">
                  <td className="p-3.5 font-mono text-sm text-white">
                    {user.username}
                  </td>
                  <td className="p-3.5 capitalize font-mono text-xs text-neutral-300">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10">
                      {user.role}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full border font-mono ${
                        user.mfa_enabled
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-white/10 text-neutral-400 border-white/10"
                      }`}
                    >
                      {user.mfa_enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-xs text-neutral-400">
                    {new Date(user.created_at).toISOString().split("T")[0]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
