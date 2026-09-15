import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { parseCSVToObjects, serializeToCSV } from "./csv-parser";

export interface EmployeeFilterOptions {
  format?: "csv" | "json";
  site?: string | null;
  status?: string | null;
  contractor?: string | null;
  accessLevel?: string | null;
  search?: string | null;
}

export interface EmployeeImportPayload {
  csvText?: string;
  employees?: Array<Record<string, unknown>>;
  generate_count?: number;
  target_site?: string;
  upsert?: boolean;
  compliance_profile?: "realistic" | "compliant" | "warning" | "expired";
  contractor_ratio?: number;
}

const FIRST_NAMES = [
  "Sipho", "Johan", "Thabo", "Lerato", "Pieter", "Naledi", "Hendrik",
  "Bongani", "Willem", "Zanele", "Kagiso", "Francois", "Mandla", "Charl",
  "Tshepo", "Dawie", "Simphiwe", "Jacques", "Kabelo", "Gerhard", "Lindiwe",
  "Stefan", "Mpho", "Andries", "Ayanda", "Dirk", "Tebogo", "Riaan", "Busisiwe",
  "Kgomotso", "Vusi", "Evert", "Nomvula", "Jaco", "Sibusiso", "Carel"
];

const SURNAMES = [
  "Dlamini", "van der Merwe", "Mokoena", "Khumalo", "Botha", "Ndlovu",
  "Venter", "Sithole", "Coetzee", "Mthembu", "Pretorius", "Nkosi", "du Plessis",
  "Molefe", "Fourie", "Baloyi", "van Zyl", "Radebe", "Nel", "Mabena", "Steyn",
  "Ngwenya", "Marais", "Chauke", "Kruger", "Maluleke", "Louw", "Schoeman",
  "Mabaso", "Ferreira", "Sibanda", "Oosthuizen", "Hlatshwayo", "Labuschagne"
];

const JOB_TITLES = [
  "Heavy Equipment Operator", "Haul Truck Driver", "Excavator Operator",
  "Articulated Dump Truck Driver", "Drill Rig Operator", "Front End Loader Operator",
  "Diesel Mechanic", "Auto Electrician", "Boilermaker / Welder", "Shift Supervisor",
  "Safety Officer", "Mine Surveyor", "Ventilation Officer", "Blasting Assistant",
  "Conveyor Technician", "Plant Operator", "Security Officer", "Sampling Technician"
];

const CONTRACTOR_COMPANIES = [
  "Murray & Roberts Mining", "Redpath Mining SA", "Barloworld Equipment",
  "Minopex Coal", "Master Drilling", "Shaft Sinkers Africa",
  "Komatsu Technical Services", "Bell Equipment Logistics", "Aveng Mining"
];

const SITES = ["Brakfontein", "Thando Tech", "Optimum", "Head Office", "North Pit"];

const CERT_OPTIONS = [
  "CAT_797_DUMP_TRUCK", "KOMATSU_PC8000_EXCAVATOR", "BELL_B50E_ADT",
  "UNDERGROUND_BLASTING", "WORKING_AT_HEIGHTS", "CONFINED_SPACE",
  "HIGH_VOLTAGE_ELECTRICAL", "HAZMAT_RESPONSE", "FIRST_AID_LEVEL_3"
];

function generateRandomSAID(): string {
  const y = Math.floor(Math.random() * 30) + 70; // 1970 - 1999
  const m = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const d = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  const cit = "08";
  const checksum = Math.floor(Math.random() * 9);
  return `${y}${m}${d}${seq}${cit}${checksum}`;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str === "N/A" || str === "null") return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Export Employees to CSV or JSON
 */
export async function exportEmployees(options: EmployeeFilterOptions = {}) {
  const format = options.format || "csv";
  const { site, status, contractor, accessLevel, search } = options;

  const isFilteredSite = site && site !== "all" && !site.toLowerCase().includes("all");

  const where: Prisma.employeesWhereInput = {};
  if (isFilteredSite) where.area = { contains: site.trim() };
  if (status && status !== "all") where.status = status;
  if (contractor === "true") where.is_contractor = true;
  else if (contractor === "false") where.is_contractor = false;
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

  const employees = await prisma.employees.findMany({
    where,
    orderBy: { emp_code: "asc" },
  });

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  if (format === "json") {
    return {
      contentType: "application/json; charset=utf-8",
      filename: `workforce_export_${dateStr}.json`,
      data: JSON.stringify(
        {
          success: true,
          count: employees.length,
          timestamp: now.toISOString(),
          employees,
        },
        null,
        2
      ),
      count: employees.length,
    };
  }

  // CSV format
  const headers = [
    "EMP Code",
    "First Name",
    "Surname",
    "Second Name",
    "Initials",
    "ID Number",
    "Job Title",
    "Area / Site",
    "Status",
    "Is Contractor",
    "Contractor Company",
    "Access Level",
    "Induction Title",
    "Induction Expiry",
    "Medical Certificate",
    "Medical Expiry",
    "Certifications",
    "RFID Tag",
    "QR Code",
    "Created At",
  ];

  const rows = employees.map((emp) => {
    const indExp = emp.induction_expiry ? emp.induction_expiry.toISOString().split("T")[0] : "N/A";
    const medExp = emp.medical_expiry ? emp.medical_expiry.toISOString().split("T")[0] : "N/A";

    return [
      emp.emp_code,
      emp.first_name,
      emp.surname,
      emp.second_name || "",
      emp.initials || "",
      emp.id_number || "REDACTED",
      emp.job_title || "General Worker",
      emp.area || "Site",
      emp.status || "Active",
      emp.is_contractor ? "YES" : "NO",
      emp.contractor_company || "N/A",
      emp.access_level || "STANDARD",
      emp.induction || "N/A",
      indExp,
      emp.medical || "N/A",
      medExp,
      emp.certifications || "[]",
      emp.rfid_tag || "N/A",
      emp.qr_code || "N/A",
      emp.created_at ? emp.created_at.toISOString() : now.toISOString(),
    ];
  });

  const csvContent = serializeToCSV(headers, rows);

  return {
    contentType: "text/csv; charset=utf-8",
    filename: `workforce_export_${dateStr}.csv`,
    data: csvContent,
    count: employees.length,
  };
}

/**
 * Import or Mass Generate Employees with Collision Resolution & Upsert
 */
export async function importEmployees(payload: EmployeeImportPayload) {
  const {
    csvText,
    employees: providedEmployees,
    generate_count,
    target_site,
    upsert = true,
    compliance_profile = "realistic",
    contractor_ratio,
  } = payload;

  const itemsToProcess: Array<Record<string, unknown>> = [];

  // 1. Synthetic Mass Generation Mode
  if (typeof generate_count === "number" && generate_count > 0) {
    const count = Math.min(Math.max(generate_count, 1), 500);
    const now = new Date();
    const effectiveContractorProb =
      typeof contractor_ratio === "number" ? Math.min(Math.max(contractor_ratio, 0), 1) : 0.35;

    for (let i = 0; i < count; i++) {
      const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
      const isContractor = Math.random() < effectiveContractorProb;
      const contractorCompany = isContractor
        ? CONTRACTOR_COMPANIES[Math.floor(Math.random() * CONTRACTOR_COMPANIES.length)]
        : null;
      const jobTitle = JOB_TITLES[Math.floor(Math.random() * JOB_TITLES.length)];
      const area = target_site || SITES[Math.floor(Math.random() * SITES.length)];
      const uniqueSuffix = `${Date.now().toString().slice(-4)}${Math.floor(100 + Math.random() * 899)}`;
      const empCode = `${isContractor ? "CON" : "EMP"}-${uniqueSuffix}`;
      const idNumber = generateRandomSAID();

      let medDays = 180;
      let indDays = 180;

      if (compliance_profile === "compliant") {
        medDays = Math.floor(Math.random() * 250) + 60;
        indDays = Math.floor(Math.random() * 250) + 60;
      } else if (compliance_profile === "warning") {
        medDays = Math.floor(Math.random() * 25) + 1; // <= 30 days
        indDays = Math.floor(Math.random() * 25) + 1;
      } else if (compliance_profile === "expired") {
        medDays = -Math.floor(Math.random() * 45) - 1; // negative = expired
        indDays = -Math.floor(Math.random() * 45) - 1;
      } else {
        // "realistic" mix: 80% compliant, 10% warning, 10% expired
        const rMed = Math.random();
        if (rMed < 0.1) medDays = -Math.floor(Math.random() * 45) - 1;
        else if (rMed < 0.2) medDays = Math.floor(Math.random() * 25) + 1;
        else medDays = Math.floor(Math.random() * 280) + 60;

        const rInd = Math.random();
        if (rInd < 0.08) indDays = -Math.floor(Math.random() * 30) - 1;
        else if (rInd < 0.18) indDays = Math.floor(Math.random() * 20) + 1;
        else indDays = Math.floor(Math.random() * 300) + 40;
      }

      const medicalExpiry = new Date(now.getTime() + medDays * 24 * 60 * 60 * 1000);
      const inductionExpiry = new Date(now.getTime() + indDays * 24 * 60 * 60 * 1000);

      const certCount = Math.floor(Math.random() * 3) + 1;
      const shuffledCerts = [...CERT_OPTIONS].sort(() => 0.5 - Math.random());
      const certs = JSON.stringify(shuffledCerts.slice(0, certCount));

      const rfidTag = `RFID-EMP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const qrCode = `QR-EMP-${empCode}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

      itemsToProcess.push({
        emp_code: empCode,
        first_name: firstName,
        surname: surname,
        initials: `${firstName[0]}${surname[0]}`,
        id_number: idNumber,
        job_title: jobTitle,
        area: area,
        status: "Active",
        is_contractor: isContractor,
        contractor_company: contractorCompany,
        induction: "Standard Mine Safety Induction",
        induction_expiry: inductionExpiry.toISOString(),
        medical: "Class 1 Occupational Fitness",
        medical_expiry: medicalExpiry.toISOString(),
        access_level: isContractor ? "STANDARD" : Math.random() > 0.8 ? "SUPERVISOR" : "STANDARD",
        certifications: certs,
        rfid_tag: rfidTag,
        qr_code: qrCode,
      });
    }
  }
  // 2. CSV Import Mode
  else if (csvText && typeof csvText === "string") {
    const parsedRows = parseCSVToObjects(csvText);
    parsedRows.forEach((row) => {
      itemsToProcess.push({
        emp_code:
          row["emp code"] ||
          row["emp_code"] ||
          row["code"] ||
          row["employee_id"] ||
          row["badge_id"] ||
          row["id"],
        first_name: row["first name"] || row["first_name"] || row["firstname"] || row["name"],
        surname: row["surname"] || row["last name"] || row["last_name"] || row["lastname"],
        second_name: row["second name"] || row["second_name"] || row["middlename"] || null,
        initials: row["initials"] || null,
        id_number: row["id number"] || row["id_number"] || row["id_no"] || null,
        job_title:
          row["job title"] || row["job_title"] || row["title"] || row["role"] || row["position"],
        area: row["area / site"] || row["area"] || row["site"] || row["location"],
        status: row["status"] || "Active",
        is_contractor:
          String(row["is contractor"] || row["is_contractor"]).toLowerCase() === "yes" ||
          String(row["is contractor"] || row["is_contractor"]).toLowerCase() === "true" ||
          Boolean(row["contractor company"] || row["contractor_company"]),
        contractor_company: row["contractor company"] || row["contractor_company"] || row["company"] || null,
        induction: row["induction title"] || row["induction"] || null,
        induction_expiry: row["induction expiry"] || row["induction_expiry"] || null,
        medical: row["medical certificate"] || row["medical"] || null,
        medical_expiry: row["medical expiry"] || row["medical_expiry"] || null,
        access_level: row["access level"] || row["access_level"] || "STANDARD",
        certifications: row["certifications"] || null,
        rfid_tag: row["rfid tag"] || row["rfid_tag"] || row["rfid"] || null,
        qr_code: row["qr code"] || row["qr_code"] || row["qr"] || null,
      });
    });
  }
  // 3. Array of objects
  else if (Array.isArray(providedEmployees)) {
    itemsToProcess.push(...providedEmployees);
  }

  if (itemsToProcess.length === 0) {
    return {
      success: false,
      error: "No employee records provided. Send 'csvText', 'employees' array, or 'generate_count'.",
      summary: { total_processed: 0, created: 0, updated: 0, skipped: 0, errors_count: 1 },
      errors: ["No valid records received"],
    };
  }

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < itemsToProcess.length; i++) {
    const item = itemsToProcess[i];
    const empCode = String(item.emp_code || "").trim();

    if (!empCode) {
      errors.push(`Row ${i + 1}: Missing employee code (emp_code)`);
      skippedCount++;
      continue;
    }

    const firstName = String(item.first_name || "Personnel").trim();
    const surname = String(item.surname || "Staff").trim();
    const idNumber = item.id_number ? String(item.id_number).trim() : null;
    const idHash = idNumber ? crypto.createHash("sha256").update(idNumber).digest("hex") : null;
    const isContractor =
      item.is_contractor === true ||
      item.is_contractor === "true" ||
      String(item.is_contractor).toLowerCase() === "yes";

    const inductionExpiry = parseDate(item.induction_expiry);
    const medicalExpiry = parseDate(item.medical_expiry);

    const rfidTag = item.rfid_tag
      ? String(item.rfid_tag).trim()
      : `RFID-${empCode}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const qrCode = item.qr_code
      ? String(item.qr_code).trim()
      : `QR-${empCode}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

    try {
      const existing = await prisma.employees.findFirst({
        where: { emp_code: empCode },
      });

      if (existing) {
        if (!upsert) {
          skippedCount++;
          continue;
        }

        // Check if updating RFID/QR collides with a DIFFERENT record
        let safeRfid = rfidTag;
        if (safeRfid !== existing.rfid_tag) {
          const rfidConflict = await prisma.employees.findUnique({ where: { rfid_tag: safeRfid } });
          if (rfidConflict && rfidConflict.id !== existing.id) {
            safeRfid = existing.rfid_tag || `RFID-${empCode}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
          }
        }

        let safeQr = qrCode;
        if (safeQr !== existing.qr_code) {
          const qrConflict = await prisma.employees.findUnique({ where: { qr_code: safeQr } });
          if (qrConflict && qrConflict.id !== existing.id) {
            safeQr = existing.qr_code || `QR-${empCode}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
          }
        }

        await prisma.employees.update({
          where: { id: existing.id },
          data: {
            first_name: firstName,
            surname: surname,
            second_name: item.second_name ? String(item.second_name).trim() : existing.second_name,
            initials: item.initials ? String(item.initials).trim() : `${firstName[0]}${surname[0]}`,
            job_title: item.job_title ? String(item.job_title).trim() : existing.job_title,
            area: item.area ? String(item.area).trim() : existing.area,
            status: item.status ? String(item.status).trim() : existing.status,
            is_contractor: isContractor,
            contractor_company: item.contractor_company
              ? String(item.contractor_company).trim()
              : existing.contractor_company,
            induction: item.induction ? String(item.induction).trim() : existing.induction,
            induction_expiry: inductionExpiry || existing.induction_expiry,
            medical: item.medical ? String(item.medical).trim() : existing.medical,
            medical_expiry: medicalExpiry || existing.medical_expiry,
            access_level: item.access_level ? String(item.access_level).trim() : existing.access_level,
            certifications: item.certifications ? String(item.certifications).trim() : existing.certifications,
            rfid_tag: safeRfid,
            qr_code: safeQr,
          },
        });
        updatedCount++;
      } else {
        // Safe check for RFID and QR collision on create
        let safeRfid = rfidTag;
        const rfidConflict = await prisma.employees.findUnique({ where: { rfid_tag: safeRfid } });
        if (rfidConflict) {
          safeRfid = `RFID-${empCode}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        }

        let safeQr = qrCode;
        const qrConflict = await prisma.employees.findUnique({ where: { qr_code: safeQr } });
        if (qrConflict) {
          safeQr = `QR-${empCode}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        }

        let safeIdNumber = idNumber;
        let safeIdHash = idHash;
        if (safeIdHash) {
          const idConflict = await prisma.employees.findUnique({ where: { id_number_hash: safeIdHash } });
          if (idConflict) {
            safeIdNumber = null;
            safeIdHash = null;
          }
        }

        await prisma.employees.create({
          data: {
            emp_code: empCode,
            first_name: firstName,
            surname: surname,
            second_name: item.second_name ? String(item.second_name).trim() : null,
            initials: item.initials ? String(item.initials).trim() : `${firstName[0]}${surname[0]}`,
            id_number: safeIdNumber,
            id_number_hash: safeIdHash,
            job_title: item.job_title ? String(item.job_title).trim() : "Mine Operator",
            area: item.area ? String(item.area).trim() : "Brakfontein",
            status: item.status ? String(item.status).trim() : "Active",
            is_contractor: isContractor,
            contractor_company: item.contractor_company ? String(item.contractor_company).trim() : null,
            induction: item.induction ? String(item.induction).trim() : "Site Safety Induction",
            induction_expiry: inductionExpiry,
            medical: item.medical ? String(item.medical).trim() : "Medical Fitness Certificate",
            medical_expiry: medicalExpiry,
            access_level: item.access_level ? String(item.access_level).trim() : "STANDARD",
            certifications: item.certifications ? String(item.certifications).trim() : null,
            rfid_tag: safeRfid,
            qr_code: safeQr,
          },
        });
        createdCount++;
      }
    } catch (rowErr) {
      const msg = rowErr instanceof Error ? rowErr.message : String(rowErr);
      errors.push(`Row ${i + 1} (${empCode}): ${msg}`);
      skippedCount++;
    }
  }

  return {
    success: true,
    summary: {
      total_processed: itemsToProcess.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors_count: errors.length,
    },
    errors: errors.slice(0, 15),
  };
}
