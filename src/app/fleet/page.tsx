import prisma from "@/lib/prisma";

export default async function FleetPage() {
  const vehicles = await prisma.vehicles.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Fleet Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map(vehicle => (
          <div key={vehicle.id} className="bg-white shadow rounded-lg p-6 border border-gray-200">
            <h3 className="text-xl font-semibold mb-2">ID: {vehicle.fleet_id}</h3>
            <p className="text-gray-600 mb-2">QR: {vehicle.qr_code || 'N/A'}</p>
            <span className={`px-2 py-1 text-xs font-bold rounded-full ${vehicle.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {vehicle.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
