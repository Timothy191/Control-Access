export interface SiteOperator {
  id: string;
  name: string;
  role: string;
}

export interface SiteInfo {
  id: string;
  name: string;
  shortCode: string;
  description: string;
  icon: "building" | "pick" | "chip" | "bolt" | "world";
  operators: SiteOperator[];
  defaultGate: string;
}

export const SITES: SiteInfo[] = [
  {
    id: "all",
    name: "All Sites (Global)",
    shortCode: "GLOBAL",
    description: "Enterprise Overview & Global Operations",
    icon: "world",
    defaultGate: "Global Gateway",
    operators: [
      { id: "admin", name: "Super Administrator", role: "admin" },
      { id: "ADM001", name: "System Admin", role: "admin" },
      { id: "EMP001", name: "John Doe", role: "manager" },
      { id: "EMP002", name: "Jane Smith", role: "operator" },
      { id: "EMP003", name: "Bob Johnson", role: "manager" },
      { id: "EMP004", name: "Alice Williams", role: "security" },
      { id: "EMP005", name: "David Miller", role: "operator" },
      { id: "EMP006", name: "Sarah Connor", role: "manager" },
    ],
  },
  {
    id: "brakfontein",
    name: "Brakfontein",
    shortCode: "BRK",
    description: "Brakfontein Colliery & North Pit Operations",
    icon: "pick",
    defaultGate: "Brakfontein - Main Gate",
    operators: [
      { id: "EMP001", name: "John Doe (Pit Operations)", role: "manager" },
      { id: "EMP002", name: "Jane Smith (Haulage)", role: "operator" },
      { id: "EMP006", name: "Sarah Connor (Dispatch)", role: "manager" },
      { id: "admin", name: "Super Admin", role: "admin" },
    ],
  },
  {
    id: "head-office",
    name: "Head Office",
    shortCode: "HQ",
    description: "Corporate HQ & Operations Command Center",
    icon: "building",
    defaultGate: "Head Office - Mobile Terminal",
    operators: [
      { id: "admin", name: "Super Administrator", role: "admin" },
      { id: "ADM001", name: "System Admin", role: "admin" },
    ],
  },
  {
    id: "thando-tech",
    name: "Thando Tech",
    shortCode: "TT",
    description: "Technology Center & Hardware Diagnostics",
    icon: "chip",
    defaultGate: "Thando Tech - Remote Turnstile",
    operators: [
      { id: "EMP004", name: "Alice Williams (Security)", role: "security" },
      { id: "admin", name: "Super Admin", role: "admin" },
    ],
  },
  {
    id: "optimum",
    name: "Optimum",
    shortCode: "OPT",
    description: "Optimum Coal Processing & Safety Division",
    icon: "bolt",
    defaultGate: "Optimum - Port 9100",
    operators: [
      { id: "EMP003", name: "Bob Johnson (Safety & Env)", role: "manager" },
      { id: "EMP005", name: "David Miller (Processing)", role: "operator" },
      { id: "admin", name: "Super Admin", role: "admin" },
    ],
  },
];

export const DEFAULT_SITE = SITES[0].name; // "All Sites (Global)"

export function normalizeSiteName(site?: string | null): string {
  if (!site) return "all";
  const s = site.toLowerCase().trim();
  if (s.includes("brak")) return "Brakfontein";
  if (s.includes("head") || s.includes("office") || s === "hq") return "Head Office";
  if (s.includes("thando") || s.includes("tech")) return "Thando Tech";
  if (s.includes("optimum")) return "Optimum";
  if (s === "all" || s.includes("global")) return "all";
  return site;
}

export function getOperatorsForSite(siteName?: string | null): SiteOperator[] {
  const norm = normalizeSiteName(siteName);
  if (norm === "all") {
    const all = SITES.find((s) => s.id === "all");
    return all ? all.operators : [];
  }
  const found = SITES.find((s) => s.name.toLowerCase() === norm.toLowerCase());
  return found ? found.operators : SITES[0].operators;
}
