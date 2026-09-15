import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { exportEmployees, importEmployees } from "@/lib/data-exchange/employee-exchange";
import { exportFleet, importFleet } from "@/lib/data-exchange/fleet-exchange";
import { parseCSVToObjects } from "@/lib/data-exchange/csv-parser";

export const dynamic = "force-dynamic";

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "test-mass-import-export") {
      const results: Array<{ name: string; passed: boolean; error?: string; durationMs: number }> = [];
      const createdTestEmpCodes: string[] = [];
      const createdTestFleetIds: string[] = [];

      function assert(condition: boolean, message: string) {
        if (!condition) {
          throw new Error(`Assertion Failed: ${message}`);
        }
      }

      function assertEqual<T>(actual: T, expected: T, message?: string) {
        if (actual !== expected) {
          throw new Error(
            `Assertion Failed: Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}. ${message || ""}`
          );
        }
      }

      async function runTest(name: string, fn: () => Promise<void> | void) {
        const start = Date.now();
        try {
          await fn();
          const durationMs = Date.now() - start;
          results.push({ name, passed: true, durationMs });
        } catch (err) {
          const durationMs = Date.now() - start;
          const msg = err instanceof Error ? err.stack || err.message : String(err);
          results.push({ name, passed: false, error: msg, durationMs });
        }
      }

      // 1. Employee Export Verification
      await runTest("Employee Export: JSON Format produces valid payload with metadata", async () => {
        const res = await exportEmployees({ format: "json" });
        assert(res.contentType.includes("application/json"), `Expected JSON content-type, got ${res.contentType}`);
        assert(res.filename.endsWith(".json"), `Expected .json extension, got ${res.filename}`);

        const parsed = JSON.parse(res.data as string);
        assert(parsed.success === true, "Expected success: true");
        assert(typeof parsed.count === "number", "Expected count property");
        assert(Array.isArray(parsed.employees), "Expected employees array");
        assert(parsed.employees.length === res.count, "Count mismatch with array length");
      });

      await runTest("Employee Export: CSV Format produces RFC-4180 BOM-prefixed table", async () => {
        const res = await exportEmployees({ format: "csv" });
        assert(res.contentType.includes("text/csv"), `Expected CSV content-type, got ${res.contentType}`);
        assert(res.filename.endsWith(".csv"), `Expected .csv extension, got ${res.filename}`);

        const csvData = res.data as string;
        assert(csvData.startsWith("\uFEFF"), "Expected UTF-8 BOM prefix for Excel interoperability");

        const parsedRows = parseCSVToObjects(csvData);
        assert(Array.isArray(parsedRows), "Expected parseCSVToObjects to return array");
        assert(parsedRows.length === res.count, `Expected ${res.count} parsed rows, got ${parsedRows.length}`);
      });

      // 2. Fleet Export Verification
      await runTest("Fleet Export: JSON Format produces valid payload with vehicle telemetry", async () => {
        const res = await exportFleet({ format: "json" });
        assert(res.contentType.includes("application/json"), `Expected JSON content-type, got ${res.contentType}`);
        assert(res.filename.endsWith(".json"), `Expected .json extension, got ${res.filename}`);

        const parsed = JSON.parse(res.data as string);
        assert(parsed.success === true, "Expected success: true");
        assert(Array.isArray(parsed.vehicles), "Expected vehicles array");
      });

      await runTest("Fleet Export: CSV Format produces RFC-4180 BOM-prefixed fleet table", async () => {
        const res = await exportFleet({ format: "csv" });
        assert(res.contentType.includes("text/csv"), `Expected CSV content-type, got ${res.contentType}`);
        assert(res.filename.endsWith(".csv"), `Expected .csv extension, got ${res.filename}`);

        const csvData = res.data as string;
        assert(csvData.startsWith("\uFEFF"), "Expected UTF-8 BOM prefix for Excel interoperability");

        const parsedRows = parseCSVToObjects(csvData);
        assert(Array.isArray(parsedRows), "Expected parseCSVToObjects to return array");
        assert(parsedRows.length === res.count, `Expected ${res.count} parsed rows, got ${parsedRows.length}`);
      });

      // 3. Employee Mass Generation
      await runTest("Employee Mass Generator: Generates 10 realistic personnel with unique codes & credentials", async () => {
        const res = await importEmployees({
          generate_count: 10,
          compliance_profile: "realistic",
          contractor_ratio: 0.4,
        });

        assert(res.success, `Expected success, got error: ${res.error}`);
        assertEqual(res.summary.created, 10, "Expected 10 created employees");
        assertEqual(res.summary.errors_count, 0, "Expected 0 errors");

        const recent = await prisma.employees.findMany({
          take: 10,
          orderBy: { id: "desc" },
        });

        for (const emp of recent) {
          createdTestEmpCodes.push(emp.emp_code);
          assert(emp.emp_code.startsWith("EMP-") || emp.emp_code.startsWith("CON-"), `Invalid code: ${emp.emp_code}`);
          assert(Boolean(emp.rfid_tag?.startsWith("RFID-EMP-")), `Invalid RFID: ${emp.rfid_tag}`);
          assert(Boolean(emp.qr_code?.startsWith("QR-EMP-")), `Invalid QR: ${emp.qr_code}`);
        }
      });

      await runTest("Employee Mass Generator: Generates 25 fully compliant personnel without collisions", async () => {
        const res = await importEmployees({
          generate_count: 25,
          compliance_profile: "compliant",
          target_site: "North Pit",
        });

        assert(res.success, `Expected success, got error: ${res.error}`);
        assertEqual(res.summary.created, 25, "Expected 25 created employees");

        const recent = await prisma.employees.findMany({
          take: 25,
          orderBy: { id: "desc" },
        });

        const now = new Date();
        for (const emp of recent) {
          createdTestEmpCodes.push(emp.emp_code);
          assertEqual(emp.area, "North Pit", "Target site must be assigned");
          assert(emp.medical_expiry !== null && emp.medical_expiry > now, "Medical must be compliant (> today)");
        }
      });

      // 4. Fleet Mass Generation
      await runTest("Fleet Mass Generator: Generates 10 Heavy Machinery units with engine hours & cert requirements", async () => {
        const res = await importFleet({
          generate_count: 10,
          vehicle_class: "HEAVY",
          compliance_profile: "compliant",
        });

        assert(res.success, `Expected success, got error: ${res.error}`);
        assertEqual(res.summary.created, 10, "Expected 10 created vehicles");

        const recent = await prisma.vehicles.findMany({
          take: 10,
          orderBy: { id: "desc" },
        });

        for (const veh of recent) {
          createdTestFleetIds.push(veh.fleet_id);
          assertEqual(veh.is_heavy_fleet, true, "is_heavy_fleet must be true for heavy fleet");
          assert((veh.operational_hours ?? 0) >= 500, "Expected operational hours >= 500");
        }
      });

      // 5. CSV Import & Upsert
      await runTest("Employee CSV Import: Upserts existing record and creates new record simultaneously", async () => {
        const testCode1 = `TEST-EMP-${Date.now()}-A`;
        const testCode2 = `TEST-EMP-${Date.now()}-B`;
        createdTestEmpCodes.push(testCode1, testCode2);

        await prisma.employees.create({
          data: {
            emp_code: testCode1,
            first_name: "OriginalFirst",
            surname: "OriginalSurname",
            job_title: "Junior Welder",
            status: "Active",
          },
        });

        const csvPayload = [
          "EMP Code,First Name,Surname,Job Title,Status",
          `${testCode1},UpdatedFirst,UpdatedSurname,Senior Master Welder,Active`,
          `${testCode2},NewbieFirst,NewbieSurname,Haul Truck Trainee,Active`,
        ].join("\n");

        const res = await importEmployees({
          csvText: csvPayload,
          upsert: true,
        });

        assert(res.success, `Expected success, got error: ${res.error}`);
        assertEqual(res.summary.created, 1, "Expected exactly 1 created record");
        assertEqual(res.summary.updated, 1, "Expected exactly 1 updated record");

        const emp1 = await prisma.employees.findUnique({ where: { emp_code: testCode1 } });
        assertEqual(emp1?.first_name, "UpdatedFirst", "First name should have been updated");
      });

      await runTest("Fleet JSON Import: Safely handles RFID collision gracefully", async () => {
        const existingFleetId = `TEST-FLT-${Date.now()}-EXIST`;
        const newFleetId = `TEST-FLT-${Date.now()}-NEW`;
        const sharedRfid = `RFID-COLLISION-${Date.now()}`;
        createdTestFleetIds.push(existingFleetId, newFleetId);

        await prisma.vehicles.create({
          data: {
            fleet_id: existingFleetId,
            vehicle_type: "HEAVY_FLEET",
            rfid_tag: sharedRfid,
            status: "Active",
          },
        });

        const res = await importFleet({
          vehicles: [
            {
              fleet_id: newFleetId,
              vehicle_type: "HEAVY_FLEET",
              rfid_tag: sharedRfid,
              make: "Komatsu",
              operational_hours: 4500,
            },
          ],
          upsert: true,
        });

        assert(res.success, `Expected collision resolution to succeed without throwing, got error: ${res.error}`);
        assertEqual(res.summary.created, 1, "Expected vehicle to be created with resolved RFID");

        const newVeh = await prisma.vehicles.findUnique({ where: { fleet_id: newFleetId } });
        assert(newVeh !== null, "New vehicle must exist");
        assert(newVeh?.rfid_tag !== sharedRfid, "RFID tag must have been regenerated to avoid unique collision");
      });

      // Cleanup
      if (createdTestEmpCodes.length > 0) {
        await prisma.employees.deleteMany({
          where: { emp_code: { in: createdTestEmpCodes } },
        });
      }

      if (createdTestFleetIds.length > 0) {
        await prisma.vehicles.deleteMany({
          where: { fleet_id: { in: createdTestFleetIds } },
        });
      }

      const passed = results.filter((r) => r.passed).length;
      const failed = results.filter((r) => !r.passed).length;
      const total = results.length;

      return NextResponse.json({
        success: failed === 0,
        summary: {
          total,
          passed,
          failed,
          pass_rate: `${((passed / total) * 100).toFixed(1)}%`,
        },
        results,
      });
    }

    const idParam = url.searchParams.get("id");
    const empCodeParam = url.searchParams.get("emp_code");
    const exportParam = url.searchParams.get("export");
    const format = url.searchParams.get("format");

    // Check if Export requested
    if (exportParam === "true" || format === "csv") {
      const site = url.searchParams.get("site");
      const status = url.searchParams.get("status");
      const contractor = url.searchParams.get("contractor");
      const accessLevel = url.searchParams.get("access_level");
      const search = url.searchParams.get("search")?.trim();

      const exportResult = await exportEmployees({
        format: format === "json" ? "json" : "csv",
        site,
        status,
        contractor,
        accessLevel,
        search,
      });

      return new Response(exportResult.data, {
        status: 200,
        headers: {
          "Content-Type": exportResult.contentType,
          "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
          "Cache-Control": "no-cache, no-store",
        },
      });
    }

    // Single lookup
    if (idParam || empCodeParam) {
      const employee = await prisma.employees.findFirst({
        where: idParam ? { id: parseInt(idParam, 10) } : { emp_code: empCodeParam! },
        include: {
          personal_vehicles: true,
          assigned_equipment: true,
          gate_logs: {
            take: 10,
            orderBy: { id: "desc" },
          },
        },
      });

      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }

      return NextResponse.json({ success: true, employee });
    }

    // List query
    const site = url.searchParams.get("site");
    const status = url.searchParams.get("status");
    const isContractorParam = url.searchParams.get("is_contractor");
    const accessLevel = url.searchParams.get("access_level");
    const search = url.searchParams.get("search")?.trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10), 1), 500);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const isFiltered = site && site !== "all" && !site.toLowerCase().includes("all");

    const where: Prisma.employeesWhereInput = {};
    if (isFiltered) where.area = { contains: site.trim() };
    if (status && status !== "all") where.status = status;
    if (isContractorParam !== null) where.is_contractor = isContractorParam === "true";
    if (accessLevel && accessLevel !== "all") where.access_level = accessLevel;

    if (search) {
      where.OR = [
        { emp_code: { contains: search } },
        { first_name: { contains: search } },
        { surname: { contains: search } },
        { job_title: { contains: search } },
        { contractor_company: { contains: search } },
        { rfid_tag: { contains: search } },
        { qr_code: { contains: search } },
      ];
    }

    const [total, employees] = await Promise.all([
      prisma.employees.count({ where }),
      prisma.employees.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    if (format === "array") {
      return NextResponse.json(employees);
    }

    return NextResponse.json({
      success: true,
      total,
      count: employees.length,
      limit,
      offset,
      employees,
    });
  } catch (error) {
    console.error("Employee GET error:", error);
    return NextResponse.json({ error: "Failed to fetch employees", details: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if Mass Generator or Import Payload was sent to /api/employees
    if (
      body.generate_count !== undefined ||
      body.csvText !== undefined ||
      Array.isArray(body.employees) ||
      body.action === "import" ||
      body.action === "generate"
    ) {
      const importResult = await importEmployees(body);
      if (!importResult.success && importResult.summary.total_processed === 0) {
        return NextResponse.json(importResult, { status: 400 });
      }
      return NextResponse.json(importResult, { status: 200 });
    }

    const empCode = body.emp_code?.trim();
    if (!empCode || empCode.length < 2) {
      return NextResponse.json({ error: "Field 'emp_code' is required", field: "emp_code" }, { status: 400 });
    }

    const existing = await prisma.employees.findUnique({
      where: { emp_code: empCode },
    });
    if (existing) {
      return NextResponse.json({ error: `Employee '${empCode}' already exists`, field: "emp_code" }, { status: 409 });
    }

    const idNumber = body.id_number?.trim() || null;
    const idHash = idNumber ? crypto.createHash("sha256").update(idNumber).digest("hex") : null;

    const firstName = body.first_name?.trim() || "Personnel";
    const surname = body.surname?.trim() || "Staff";

    const rfidTag = body.rfid_tag?.trim() || `RFID-${empCode}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const qrCode = body.qr_code?.trim() || `QR-${empCode}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    const newEmployee = await prisma.employees.create({
      data: {
        emp_code: empCode,
        first_name: firstName,
        surname: surname,
        second_name: body.second_name?.trim() || null,
        initials: body.initials?.trim() || `${firstName[0]}${surname[0]}`,
        id_number: idNumber,
        id_number_hash: idHash,
        job_title: body.job_title?.trim() || "General Worker",
        area: body.area?.trim() || "Brakfontein",
        status: body.status?.trim() || "Active",
        is_contractor: body.is_contractor === true || body.is_contractor === "true",
        contractor_company: body.contractor_company?.trim() || null,
        induction: body.induction?.trim() || "Annual Safety Induction",
        induction_expiry: parseDate(body.induction_expiry),
        medical: body.medical?.trim() || "Occupational Medical Fitness",
        medical_expiry: parseDate(body.medical_expiry),
        access_level: body.access_level?.trim() || "STANDARD",
        certifications: body.certifications ? String(body.certifications) : null,
        rfid_tag: rfidTag,
        qr_code: qrCode,
      },
    });

    return NextResponse.json({ success: true, employee: newEmployee }, { status: 201 });
  } catch (error) {
    console.error("Employee POST error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Unique constraint violation on employee registration" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create employee", details: String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json();

    const targetId = parseInt(url.searchParams.get("id") || String(body.id || ""), 10);
    const targetEmpCode = url.searchParams.get("emp_code") || body.emp_code;

    if (!targetId && !targetEmpCode) {
      return NextResponse.json({ error: "Employee 'id' or 'emp_code' required for update" }, { status: 400 });
    }

    const existing = await prisma.employees.findFirst({
      where: targetId ? { id: targetId } : { emp_code: targetEmpCode },
    });

    if (!existing) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const updateData: Prisma.employeesUpdateInput = {};

    if (body.first_name !== undefined) updateData.first_name = body.first_name.trim();
    if (body.surname !== undefined) updateData.surname = body.surname.trim();
    if (body.second_name !== undefined) updateData.second_name = body.second_name?.trim() || null;
    if (body.initials !== undefined) updateData.initials = body.initials?.trim() || null;
    if (body.job_title !== undefined) updateData.job_title = body.job_title?.trim() || null;
    if (body.area !== undefined) updateData.area = body.area?.trim() || null;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.is_contractor !== undefined) updateData.is_contractor = Boolean(body.is_contractor);
    if (body.contractor_company !== undefined) updateData.contractor_company = body.contractor_company?.trim() || null;
    if (body.induction !== undefined) updateData.induction = body.induction?.trim() || null;
    if (body.induction_expiry !== undefined) updateData.induction_expiry = parseDate(body.induction_expiry);
    if (body.medical !== undefined) updateData.medical = body.medical?.trim() || null;
    if (body.medical_expiry !== undefined) updateData.medical_expiry = parseDate(body.medical_expiry);
    if (body.access_level !== undefined) updateData.access_level = body.access_level;
    if (body.certifications !== undefined) updateData.certifications = body.certifications ? String(body.certifications) : null;

    if (body.rfid_tag !== undefined) {
      const rfid = body.rfid_tag?.trim() || null;
      if (rfid && rfid !== existing.rfid_tag) {
        const conflict = await prisma.employees.findUnique({ where: { rfid_tag: rfid } });
        if (conflict && conflict.id !== existing.id) {
          return NextResponse.json({ error: `RFID tag '${rfid}' is already in use` }, { status: 409 });
        }
      }
      updateData.rfid_tag = rfid;
    }

    if (body.qr_code !== undefined) {
      const qr = body.qr_code?.trim() || null;
      if (qr && qr !== existing.qr_code) {
        const conflict = await prisma.employees.findUnique({ where: { qr_code: qr } });
        if (conflict && conflict.id !== existing.id) {
          return NextResponse.json({ error: `QR code '${qr}' is already in use` }, { status: 409 });
        }
      }
      updateData.qr_code = qr;
    }

    const updated = await prisma.employees.update({
      where: { id: existing.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, employee: updated });
  } catch (error) {
    console.error("Employee PUT error:", error);
    return NextResponse.json({ error: "Failed to update employee", details: String(error) }, { status: 500 });
  }
}

export const PATCH = PUT;

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get("id");
    const empCodeParam = url.searchParams.get("emp_code");
    const mode = url.searchParams.get("mode") || "soft";

    if (!idParam && !empCodeParam) {
      return NextResponse.json({ error: "Parameter 'id' or 'emp_code' required" }, { status: 400 });
    }

    const existing = await prisma.employees.findFirst({
      where: idParam ? { id: parseInt(idParam, 10) } : { emp_code: empCodeParam! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (mode === "hard") {
      try {
        await prisma.employees.delete({ where: { id: existing.id } });
        return NextResponse.json({ success: true, message: "Employee deleted permanently" });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
          return NextResponse.json({
            error: "Cannot hard-delete employee with active gate logs or assigned keys. Use mode=soft instead.",
            canSoftDelete: true,
          }, { status: 409 });
        }
        throw err;
      }
    }

    // Soft delete
    const softDeleted = await prisma.employees.update({
      where: { id: existing.id },
      data: { status: "Inactive" },
    });

    return NextResponse.json({
      success: true,
      message: "Employee status set to Inactive (soft delete)",
      employee: softDeleted,
    });
  } catch (error) {
    console.error("Employee DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete employee", details: String(error) }, { status: 500 });
  }
}
