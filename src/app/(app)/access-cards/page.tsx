import prisma from "@/lib/prisma";
import AccessCardsClient from "./AccessCardsClient";

export const dynamic = "force-dynamic";

export default async function AccessCardsPage() {
  // Fetch lists for the dropdowns
  const employees = await prisma.employees.findMany({
    select: { id: true, emp_code: true, first_name: true, surname: true, rfid_tag: true, qr_code: true },
    orderBy: { surname: "asc" }
  });
  
  const visitors = await prisma.visitors.findMany({
    select: { id: true, name: true, company: true, rfid_tag: true, qr_code: true },
    orderBy: { name: "asc" }
  });

  return <AccessCardsClient employees={employees} visitors={visitors} />;
}
