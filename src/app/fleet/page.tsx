import prisma from "@/lib/prisma";

export default async function FleetPage() {
  const vehicles = await prisma.vehicles.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-text-primary">
        Fleet Management
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id} className="glass-card">
            <h3 className="text-xl font-semibold mb-2 text-text-primary">
              ID: {vehicle.fleet_id}
            </h3>
            <p className="text-text-secondary mb-2 font-mono text-sm">
              QR: {vehicle.qr_code || "N/A"}
            </p>
            <span
              className={`px-2 py-1 text-xs font-bold rounded-full border ${
                vehicle.status === "Active"
                  ? "bg-success/20 text-success border-success/30"
                  : "bg-danger/20 text-danger border-danger/30"
              }`}
            >
              {vehicle.status}
            </span>
          </div>
        ))}
        {vehicles.length === 0 && (
          <div className="glass-card col-span-full text-center text-text-secondary py-8">
            No vehicles registered.
          </div>
        )}
      </div>
    </div>
  );
}
