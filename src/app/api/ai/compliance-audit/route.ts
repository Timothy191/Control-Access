import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalEmployees,
      totalContractors,
      totalVehicles,
      heavyFleet,
      totalEquipment,
      totalLogs,
      recentDenials,
      expiringMedicals,
      expiringInductions,
    ] = await Promise.all([
      prisma.employees.count({ where: { is_contractor: false } }),
      prisma.employees.count({ where: { is_contractor: true } }),
      prisma.vehicles.count({ where: { is_heavy_fleet: false } }),
      prisma.vehicles.findMany({ where: { is_heavy_fleet: true } }),
      prisma.equipment.count(),
      prisma.gate_logs.count(),
      prisma.gate_logs.findMany({
        where: { access_granted: false },
        take: 50,
        orderBy: { id: "desc" },
      }),
      prisma.employees.findMany({
        where: {
          status: "Active",
          medical_expiry: {
            not: null,
            lte: thirtyDaysFromNow,
          },
        },
        select: {
          id: true,
          first_name: true,
          surname: true,
          emp_code: true,
          medical_expiry: true,
          is_contractor: true,
          contractor_company: true,
        },
      }),
      prisma.employees.findMany({
        where: {
          status: "Active",
          induction_expiry: {
            not: null,
            lte: thirtyDaysFromNow,
          },
        },
        select: {
          id: true,
          first_name: true,
          surname: true,
          emp_code: true,
          induction_expiry: true,
          is_contractor: true,
          contractor_company: true,
        },
      }),
    ]);

    // Cluster denial reasons
    const denialCluster: Record<string, number> = {};
    let uninductedAttempts = 0;
    for (const log of recentDenials) {
      const reason = log.denial_reason || "Unspecified Denial";
      denialCluster[reason] = (denialCluster[reason] || 0) + 1;
      if (reason.toLowerCase().includes("uninducted") || reason.toLowerCase().includes("induction")) {
        uninductedAttempts++;
      }
    }

    const calcDaysRemaining = (date: Date | null) => {
      if (!date) return 0;
      const diff = new Date(date).getTime() - now.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const medicalExpiringFormatted = expiringMedicals.map((emp) => ({
      id: emp.id,
      name: `${emp.first_name} ${emp.surname}`,
      emp_code: emp.emp_code,
      medical_expiry: emp.medical_expiry ? emp.medical_expiry.toISOString() : null,
      daysRemaining: calcDaysRemaining(emp.medical_expiry),
      is_contractor: emp.is_contractor,
      contractor_company: emp.contractor_company,
    }));

    const inductionExpiringFormatted = expiringInductions.map((emp) => ({
      id: emp.id,
      name: `${emp.first_name} ${emp.surname}`,
      emp_code: emp.emp_code,
      induction_expiry: emp.induction_expiry ? emp.induction_expiry.toISOString() : null,
      daysRemaining: calcDaysRemaining(emp.induction_expiry),
      is_contractor: emp.is_contractor,
      contractor_company: emp.contractor_company,
    }));

    // Calculate site compliance index
    const totalExpiring = expiringMedicals.length + expiringInductions.length;
    const totalWorkforce = totalEmployees + totalContractors;
    let complianceIndex = 100;
    if (totalWorkforce > 0) {
      const deduction = (totalExpiring / (totalWorkforce * 2)) * 15 + Math.min(recentDenials.length * 0.5, 10);
      complianceIndex = Math.max(70, Math.min(100, Math.round((100 - deduction) * 10) / 10));
    }

    let riskLevel: "LOW" | "MODERATE" | "ELEVATED" | "CRITICAL" = "LOW";
    if (complianceIndex < 80 || uninductedAttempts > 5) {
      riskLevel = "CRITICAL";
    } else if (complianceIndex < 90 || totalExpiring > 10) {
      riskLevel = "ELEVATED";
    } else if (complianceIndex < 95 || totalExpiring > 3) {
      riskLevel = "MODERATE";
    }

    // Actionable AI recommendations
    const actionableRecommendations: string[] = [];
    if (expiringMedicals.length > 0) {
      actionableRecommendations.push(
        `Schedule OH&S occupational health assessments for ${expiringMedicals.length} personnel with medical fitness certificates expiring within 30 days.`
      );
    }
    if (expiringInductions.length > 0) {
      actionableRecommendations.push(
        `Queue ${expiringInductions.length} workers for mandatory site safety induction refresher courses prior to expiration.`
      );
    }
    if (uninductedAttempts > 0) {
      actionableRecommendations.push(
        `Alert contractor liaison: ${uninductedAttempts} gate access attempts blocked due to missing or expired contractor safety inductions.`
      );
    }
    if (heavyFleet.some((v) => (v.operational_hours || 0) >= 2000)) {
      actionableRecommendations.push(
        "Heavy Earth-Moving Fleet: Operating hours threshold reached for scheduled 2,000-hour mechanical service and hydraulic inspection."
      );
    }
    if (actionableRecommendations.length === 0) {
      actionableRecommendations.push("All site compliance indicators, contractor inductions, and medical certificates are currently in optimal standing.");
    }

    return NextResponse.json({
      timestamp: now.toISOString(),
      complianceIndex,
      riskLevel,
      summary: {
        totalWorkforce: totalEmployees,
        activeContractors: totalContractors,
        totalVehicles,
        heavyFleetMachines: heavyFleet.length,
        totalEquipment,
        totalScansRecorded: totalLogs,
      },
      expirations: {
        medicalExpiringSoon: medicalExpiringFormatted,
        inductionExpiringSoon: inductionExpiringFormatted,
      },
      anomalies: {
        denialCluster,
        recentDenialsCount: recentDenials.length,
        uninductedAttempts,
      },
      heavyFleetAlerts: heavyFleet.map((f) => ({
        id: f.id,
        fleet_id: f.fleet_id,
        model: f.model,
        operational_hours: f.operational_hours,
        status: f.status,
      })),
      actionableRecommendations,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Compliance audit error:", error);
    return NextResponse.json(
      { error: "Failed to generate compliance audit", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
