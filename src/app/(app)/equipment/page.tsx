import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import EquipmentExplorer from "@/components/equipment/EquipmentExplorer";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/equipment")}`);

  const equipment = await prisma.equipment.findMany({
    orderBy: { created_at: "desc" },
    include: {
      assigned_to: {
        select: {
          id: true,
          emp_code: true,
          first_name: true,
          surname: true,
        },
      },
    },
  });

  const formattedEquipment = equipment.map((item) => ({
    id: item.id,
    radio_id: item.radio_id,
    equipment_type: item.equipment_type,
    model_name: item.model_name,
    serial_number: item.serial_number,
    barcode: item.barcode,
    rfid_tag: item.rfid_tag,
    qr_code: item.qr_code,
    status: item.status,
    calibration_expiry: item.calibration_expiry ? item.calibration_expiry.toISOString() : null,
    registration_expiry: item.registration_expiry ? item.registration_expiry.toISOString() : null,
    assigned_to: item.assigned_to,
    created_at: item.created_at.toISOString(),
  }));

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto">
      <EquipmentExplorer equipment={formattedEquipment} />
    </div>
  );
}
