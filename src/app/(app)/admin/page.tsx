import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/admin")}`);
  if (session.user.role !== "admin") redirect("/");

  const users = await prisma.users.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-text-primary">
        Admin Settings
      </h1>

      <div className="glass-card">
        <h2 className="text-lg font-semibold mb-4 text-text-primary">
          System Users
        </h2>
        <div className="glass-table overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>MFA Enabled</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="whitespace-nowrap font-mono text-sm">
                    {user.username}
                  </td>
                  <td className="whitespace-nowrap capitalize">{user.role}</td>
                  <td className="whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded border ${
                        user.mfa_enabled
                          ? "bg-success/20 text-success border-success/30"
                          : "bg-white/10 text-text-secondary border-white/10"
                      }`}
                    >
                      {user.mfa_enabled ? "Yes" : "No"}
                    </span>
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
