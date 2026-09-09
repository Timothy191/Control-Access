import prisma from "@/lib/prisma";

export default async function VisitorsPage() {
  const visitors = await prisma.visitors.findMany({
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Visitors ({visitors.length})</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visitors.map((visitor) => (
          <div key={visitor.id} className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <h3 className="text-lg font-medium">{visitor.name}</h3>
            <p className="text-sm text-gray-500 mb-2">{visitor.company || "No Company"}</p>
            <div className="flex justify-between items-center mt-4">
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${visitor.status === 'Checked In' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                {visitor.status}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(visitor.check_in_time).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
