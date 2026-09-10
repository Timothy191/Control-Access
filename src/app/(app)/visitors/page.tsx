import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import VisitorExplorer from "@/components/visitors/VisitorExplorer";

export default async function VisitorsPage() {
  const session = await auth();
  if (!session?.user)
    redirect(`/login?callbackUrl=${encodeURIComponent("/visitors")}`);

  const visitors = await prisma.visitors.findMany({
    include: {
      host: {
        select: {
          id: true,
          first_name: true,
          surname: true,
          department: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  return (
    <div className="p-6 md:p-8">
      <VisitorExplorer visitors={visitors} />
    </div>
  );
}

