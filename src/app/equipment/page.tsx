import prisma from "@/lib/prisma";

export default async function EquipmentPage() {
  const equipment = await prisma.equipment.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4 text-text-primary">
        Equipment Management
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {equipment.map((item) => (
          <div key={item.id} className="glass-card">
            <h3 className="font-semibold text-lg mb-1 text-text-primary">
              Radio: {item.radio_id}
            </h3>
            <p className="text-sm text-text-secondary mb-2 font-mono">
              QR: {item.qr_code || "N/A"}
            </p>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded border ${
                item.status === "Active"
                  ? "bg-success/20 text-success border-success/30"
                  : "bg-danger/20 text-danger border-danger/30"
              }`}
            >
              {item.status}
            </span>
          </div>
        ))}
        {equipment.length === 0 && (
          <div className="glass-card col-span-full text-center text-text-secondary py-8">
            No equipment registered.
          </div>
        )}
      </div>
    </div>
  );
}
