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
    include: {
      owner: {
        select: {
          id: true,
          emp_code: true,
          first_name: true,
          surname: true,
        },
      },
    },
  });

  const formattedVehicles = vehicles.map((v) => ({
    id: v.id,
    fleet_id: v.fleet_id,
    machine_id: v.machine_id,
    vehicle_type: v.vehicle_type,
    is_heavy_fleet: v.is_heavy_fleet,
    make: v.make,
    model: v.model,
    license_plate: v.license_plate,
    license_disc_expiry: v.license_disc_expiry ? v.license_disc_expiry.toISOString() : null,
    roadworthy_expiry: v.roadworthy_expiry ? v.roadworthy_expiry.toISOString() : null,
    registration_expiry: v.registration_expiry ? v.registration_expiry.toISOString() : null,
    operational_hours: v.operational_hours,
    required_certification: v.required_certification,
    owner_id: v.owner_id,
    owner: v.owner,
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
