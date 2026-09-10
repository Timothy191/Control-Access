import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import FleetExplorer from "@/components/fleet/FleetExplorer";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/fleet")}`);

  const vehicles = await prisma.vehicles.findMany({
    orderBy: { created_at: "desc" },
  });

  const formattedVehicles = vehicles.map((v) => ({
    id: v.id,
    fleet_id: v.fleet_id,
    qr_code: v.qr_code,
    rfid_tag: v.rfid_tag,
    status: v.status || "Active",
    created_at: v.created_at ? v.created_at.toISOString() : new Date().toISOString(),
  }));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <FleetExplorer vehicles={formattedVehicles} />
    </div>
  );
}
