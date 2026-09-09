import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export default async function VisitorsPage() {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/visitors")}`);

  const visitors = await prisma.visitors.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-text-primary">
        Visitors ({visitors.length})
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visitors.map((visitor) => (
          <div key={visitor.id} className="glass-card">
            <h3 className="text-lg font-medium text-text-primary">
              {visitor.name}
            </h3>
            <p className="text-sm text-text-secondary mb-2">
              {visitor.company || "No Company"}
            </p>
            <div className="flex justify-between items-center mt-4">
              <span
                className={`px-2 py-1 text-xs font-semibold rounded-full border ${
                  visitor.status === "Checked In"
                    ? "bg-success/20 text-success border-success/30"
                    : "bg-white/10 text-text-secondary border-white/10"
                }`}
              >
                {visitor.status}
              </span>
              <span className="text-xs text-text-secondary">
                {new Date(visitor.check_in_time).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
        {visitors.length === 0 && (
          <div className="glass-card col-span-full text-center text-text-secondary py-8">
            No visitors recorded.
          </div>
        )}
      </div>
    </div>
  );
}
