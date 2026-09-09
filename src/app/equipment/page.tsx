import prisma from "@/lib/prisma";

export default async function EquipmentPage() {
  const equipment = await prisma.equipment.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Equipment Management</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {equipment.map(item => (
          <div key={item.id} className="bg-white shadow-sm rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-lg mb-1">Radio: {item.radio_id}</h3>
            <p className="text-sm text-gray-500 mb-2">QR: {item.qr_code || 'N/A'}</p>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${item.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
