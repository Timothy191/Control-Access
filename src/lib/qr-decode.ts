/**
 * Universal QR decoder — TypeScript port of `decode_qr_data` from the legacy
 * Flask `app.py`. Parses any QR format into a normalized dict.
 *
 * Supports: JSON, pipe-delimited, CSV, URL query string, vCard, and
 * 'Key: Value' line-based formats.
 */

export interface DecodedQr {
  raw_data: string;
  format: string;
  employee_id?: string | null;
  name?: string | null;
  position?: string | null;
  department?: string | null;
  area?: string | null;
  fleet_id?: string | null;
  vehicle_type?: string | null;
}

const VEHICLE_KEYWORDS = ["TRUCK", "LDV", "DUMP", "EXCAVATOR"];

function isVehicleId(firstPart: string): boolean {
  return (
    /^[A-Z]{2,}\d+/i.test(firstPart) ||
    VEHICLE_KEYWORDS.some((k) => firstPart.toUpperCase().includes(k))
  );
}

function isAlnumId(value: string): boolean {
  return (
    value.replace(/-/g, "").replace(/_/g, "").length > 0 &&
    /^[a-zA-Z0-9]+$/.test(value.replace(/-/g, "").replace(/_/g, ""))
  );
}

export function decodeQrData(raw: string | null | undefined): DecodedQr {
  const result: DecodedQr = { raw_data: raw ?? "", format: "unknown" };
  if (!raw || !raw.trim()) return result;
  const data = raw.trim();

  // 1. JSON
  if (data.startsWith("{")) {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") {
        result.format = "json";
        result.employee_id =
          parsed.employee_id ?? parsed.emp_code ?? parsed.id ?? null;
        result.name = parsed.name ?? parsed.full_name ?? null;
        result.position =
          parsed.position ?? parsed.job ?? parsed.job_title ?? null;
        result.department =
          parsed.department ?? parsed.coy ?? parsed.company ?? null;
        result.area = parsed.area ?? null;
        result.fleet_id =
          parsed.fleet_id ??
          parsed.vehicle_id ??
          parsed.fleet ??
          parsed.registration ??
          null;
        result.vehicle_type =
          parsed.vehicle_type ?? parsed.type ?? parsed.model ?? null;
        return result;
      }
    } catch {
      // fall through
    }
  }

  // 2. URL query string (?id=123&name=John or full URL)
  if (data.includes("?") && data.includes("=")) {
    try {
      const queryStr = data.split("?", 1)[1] ?? data;
      const params = new URLSearchParams(queryStr);
      if (params.size > 0) {
        result.format = "url_query";
        result.employee_id =
          params.get("id") ??
          params.get("emp_code") ??
          params.get("employee_id");
        result.name = params.get("name") ?? params.get("full_name");
        result.position = params.get("position") ?? params.get("job");
        result.department =
          params.get("department") ??
          params.get("company") ??
          params.get("coy");
        result.fleet_id =
          params.get("fleet_id") ??
          params.get("vehicle_id") ??
          params.get("fleet") ??
          params.get("registration");
        result.vehicle_type =
          params.get("vehicle_type") ??
          params.get("type") ??
          params.get("model");
        return result;
      }
    } catch {
      // fall through
    }
  }

  // 3. vCard
  if (data.toUpperCase().startsWith("BEGIN:VCARD")) {
    result.format = "vcard";
    const fnMatch = data.match(/FN:(.*)/);
    if (fnMatch) result.name = fnMatch[1].trim();
    const nMatch = data.match(/(?:^|\n)N:([^;]*);([^;]*)/);
    if (nMatch) {
      result.name = result.name ?? `${nMatch[2].trim()} ${nMatch[1].trim()}`;
    }
    const orgMatch = data.match(/ORG:(.*)/);
    if (orgMatch) result.department = orgMatch[1].trim();
    const titleMatch = data.match(/TITLE:(.*)/);
    if (titleMatch) result.position = titleMatch[1].trim();
    return result;
  }

  // 4. Key: Value per line (e.g. "ID: 123\nName: John\nJob: Miner")
  const kvPatterns: Record<string, RegExp> = {
    employee_id: /(?:ID|Emp(?:loyee)?\s*(?:ID|Code))[:\s]+([^|\n]+)/i,
    name: /(?:Name(?:\s+and\s+Surname)?)[:\s]+([^|\n]+)/i,
    position: /(?:Job(?:\s*Title)?|Position|Occupation)[:\s]+([^|\n]+)/i,
    department: /(?:Coy|Company|Dept|Department)[:\s]+([^|\n]+)/i,
    area: /(?:Area|Section|Zone)[:\s]+([^|\n]+)/i,
    fleet_id: /(?:Fleet(?:\s*ID)?|Vehicle\s*ID|Registration)[:\s]+([^|\n]+)/i,
    vehicle_type: /(?:Vehicle\s*Type|Type|Model)[:\s]+([^|\n]+)/i,
  };
  let kvFound = false;
  for (const [key, pattern] of Object.entries(kvPatterns)) {
    const match = data.match(pattern);
    if (match) {
      (result as unknown as Record<string, string | null>)[key] =
        match[1].trim();
      kvFound = true;
    }
  }
  if (kvFound) {
    result.format = "key_value";
    return result;
  }

  // 5. Pipe-delimited (e.g. "123|John Doe|Miner|Acme Corp" or "TRUCK001|Volvo|Dump Truck")
  if (data.includes("|")) {
    const parts = data
      .split("|")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (parts.length >= 2) {
      result.format = "pipe";
      const firstPart = parts[0];
      if (isVehicleId(firstPart)) {
        result.fleet_id = firstPart;
        result.vehicle_type = parts[1] ?? null;
      } else {
        result.employee_id = isAlnumId(firstPart) ? firstPart : null;
        result.name = parts[1] ?? null;
        result.position = parts[2] ?? null;
        result.department = parts[3] ?? null;
        result.area = parts[4] ?? null;
      }
      return result;
    }
  }

  // 6. CSV (e.g. "123,John Doe,Miner,Acme Corp" or "TRUCK001,Volvo,2020")
  if (data.includes(",") && !data.includes("\n")) {
    const parts = data
      .split(",")
      .map((p) => p.trim().replace(/^"|"$/g, ""))
      .filter((p) => p.length > 0);
    if (parts.length >= 2) {
      result.format = "csv";
      const firstPart = parts[0];
      if (isVehicleId(firstPart)) {
        result.fleet_id = firstPart;
        result.vehicle_type = parts[1] ?? null;
      } else {
        result.employee_id = isAlnumId(firstPart) ? firstPart : null;
        result.name = parts[1] ?? null;
        result.position = parts[2] ?? null;
        result.department = parts[3] ?? null;
      }
      return result;
    }
  }

  // 7. Plain text fallback — treat entire string as an ID or name
  result.format = "plain";
  if (isAlnumId(data) && data.length <= 50) {
    result.employee_id = data;
  } else {
    result.name = data.slice(0, 100);
  }
  return result;
}
