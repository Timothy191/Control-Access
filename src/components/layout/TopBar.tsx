"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useSite } from "./SiteContext";
import {
  IconBell,
  IconLogout,
  IconMapPin,
  IconChevronDown,
  IconCheck,
  IconMenu2,
  IconX,
  IconDashboard,
  IconUsers,
  IconUserCheck,
  IconTruck,
  IconRadio,
  IconIdBadge2,
  IconDeviceMobile,
  IconDatabase,
  IconSettings,
  IconClipboardCheck,
  IconQrcode,
  IconShieldCheck,
  IconActivity,
  IconChevronRight,
  IconBuildingSkyscraper,
} from "@tabler/icons-react";
import Link from "next/link";
import BrandLogo from "@/components/common/BrandLogo";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { selectedSite, setSelectedSite, availableSites } = useSite();
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/dashboard/stats?site=${encodeURIComponent(selectedSite)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setPendingApprovals(data.pendingApprovals || 0);
      } catch {
        // badge keeps last known value; not critical
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selectedSite]);

  const getPageTitle = () => {
    switch (pathname) {
      case "/":
        return "Executive Dashboard";
      case "/employees":
        return "Personnel Register";
      case "/visitors":
        return "Visitor & Contractor Log";
      case "/fleet":
        return "Fleet & Heavy Machinery";
      case "/equipment":
        return "Equipment & Tool Custody";
      case "/approvals":
        return "Gate Authorizations";
      case "/database":
        return "System Database & WAL Backups";
      case "/admin":
        return "Enterprise Configuration";
      case "/access-cards":
        return "Smart Credential Provisioning";
      case "/onboard":
        return "Hardware Terminal Onboarding";
      case "/onboard/scanner":
        return "Chainway C66 Provisioning";
      default:
        return "Operations Portal";
    }
  };

  const handleSiteSelect = (siteName: string) => {
    setSelectedSite(siteName);
    setSiteDropdownOpen(false);
    router.refresh();
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  const userName = session?.user?.name || "System Executive";
  const userRole = session?.user?.role || "admin";

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return { label: "SEC-L4 • ADMIN", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" };
      case "manager":
        return { label: "SEC-L3 • SUPERVISOR", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" };
      case "security":
        return { label: "SEC-L2 • GATE OPERATOR", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" };
      default:
        return { label: "SEC-L1 • STANDARD", color: "bg-slate-500/10 text-slate-400 border-slate-500/30" };
    }
  };

  const roleInfo = getRoleBadge(userRole);

  const quickNavSections = [
    {
      category: "Operations",
      items: [
        { name: "Executive Dashboard", href: "/", icon: IconDashboard },
        { name: "Scanner Terminal", href: "/scanner", icon: IconQrcode },
        { name: "Approvals & Custody", href: "/approvals", icon: IconClipboardCheck },
      ],
    },
    {
      category: "Workforce & Logistics",
      items: [
        { name: "Personnel Register", href: "/employees", icon: IconUsers },
        { name: "Visitor Access Log", href: "/visitors", icon: IconUserCheck },
        { name: "Fleet Management", href: "/fleet", icon: IconTruck },
        { name: "Equipment Tracking", href: "/equipment", icon: IconRadio },
        { name: "Access Credentials", href: "/access-cards", icon: IconIdBadge2 },
      ],
    },
    {
      category: "Governance & Systems",
      items: [
        { name: "Device Onboarding", href: "/onboard", icon: IconDeviceMobile },
        { name: "Database & WAL Backups", href: "/database", icon: IconDatabase },
        { name: "Enterprise Settings", href: "/admin", icon: IconSettings },
      ],
    },
  ];

  return (
    <header className="w-full h-15 px-4 sm:px-6 flex items-center justify-between backdrop-blur-2xl bg-[#0B1120]/85 border-b border-slate-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.4)] sticky top-0 z-20 mb-6 font-sans">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Navigation Menu Toggle Button */}
        <div className="relative z-30">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`h-[38px] w-[38px] flex items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer active:scale-[0.96] ${
              menuOpen
                ? "bg-blue-600 text-white border-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.5)]"
                : "bg-slate-900/60 text-slate-200 border-slate-700/60 hover:bg-slate-800/80 hover:text-white hover:border-blue-500/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            }`}
            aria-label="Toggle Navigation Menu"
            title="Navigation Menu"
          >
            {menuOpen ? <IconX size={18} /> : <IconMenu2 size={18} />}
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute left-0 top-full mt-2 w-76 rounded-2xl border border-slate-800 bg-[#0F172A]/95 p-3 shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-3xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <IconBuildingSkyscraper size={16} className="text-blue-400" />
                    <span className="text-xs font-semibold text-white tracking-tight">Enterprise Navigation</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("open-sidebar"));
                    }}
                    className="text-[10px] font-mono text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded transition cursor-pointer"
                  >
                    Open Drawer →
                  </button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {quickNavSections.map((sec) => (
                    <div key={sec.category} className="space-y-1">
                      <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                        {sec.category}
                      </div>
                      {sec.items.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className={`flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-medium transition cursor-pointer active:scale-[0.98] ${
                              active
                                ? "bg-blue-600 text-white shadow-sm font-semibold"
                                : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                            }`}
                          >
                            <Icon size={16} className={active ? "text-white" : "text-slate-400"} />
                            <span className="flex-1 truncate">{item.name}</span>
                            {active && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Corporate Standard Breadcrumb Hierarchy */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400">
          <BrandLogo size="sm" iconOnly withLink={false} />
          <span className="text-slate-200 font-bold tracking-wider">PLANTCOR</span>
          <IconChevronRight size={13} className="text-slate-600" />
          <span className="text-slate-400 truncate max-w-[140px] lg:max-w-[200px]">{selectedSite.toUpperCase()}</span>
          <IconChevronRight size={13} className="text-slate-600" />
          <h2 className="font-sans font-semibold text-sm text-white tracking-tight">
            {getPageTitle()}
          </h2>
        </div>

        <div className="md:hidden">
          <h2 className="font-sans font-semibold text-sm text-white tracking-tight">
            {getPageTitle()}
          </h2>
        </div>

        {/* Global Facility Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
            className="flex items-center gap-2 h-[38px] px-3 py-1.5 rounded-xl border border-slate-700/60 bg-slate-900/60 hover:bg-slate-800/80 hover:border-blue-500/40 active:scale-[0.98] text-xs font-sans text-slate-200 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] cursor-pointer"
            aria-label="Select Facility Site"
          >
            <IconMapPin size={15} className="text-blue-400 shrink-0" />
            <span className="font-medium max-w-[110px] truncate sm:max-w-[150px]">{selectedSite}</span>
            <IconChevronDown size={14} className="text-slate-400 shrink-0" />
          </button>

          {siteDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setSiteDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-slate-800 bg-[#0F172A]/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl z-25">
                <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800 mb-1">
                  Select Facility Complex
                </div>
                {availableSites.map((site) => {
                  const isSelected = selectedSite.toLowerCase() === site.name.toLowerCase();
                  return (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => handleSiteSelect(site.name)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 text-white font-medium shadow-xs"
                          : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{site.name}</span>
                        <span className={`text-[10px] ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                          {site.description}
                        </span>
                      </div>
                      {isSelected && <IconCheck size={14} className="text-white shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Controls: Telemetry SLA Badge, Approvals Notification, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Enterprise System Telemetry Badge */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-800/80 bg-slate-900/60 text-[11px] font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-300 font-medium">SLA 99.98%</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">WAL ACTIVE</span>
        </div>

        {/* Security Clearance Badge */}
        <div className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${roleInfo.color}`}>
          {roleInfo.label}
        </div>

        {/* Notification Bell */}
        <button
          className="h-[38px] w-[38px] flex items-center justify-center hover:bg-slate-800/80 text-slate-300 hover:text-white rounded-xl transition-colors relative cursor-pointer active:scale-[0.98] border border-slate-800/60"
          aria-label="Notifications"
          type="button"
          onClick={() => router.push("/approvals")}
        >
          <IconBell size={18} />
          {pendingApprovals !== null && pendingApprovals > 0 && (
            <span className="absolute top-1 right-1 min-w-[15px] h-3.5 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
              {pendingApprovals > 9 ? "9+" : pendingApprovals}
            </span>
          )}
        </button>

        <div className="h-4 w-px bg-slate-800" />

        {/* User Account & Sign Out */}
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex flex-col items-end text-right mr-1">
            <span className="text-xs font-semibold text-white leading-tight">
              {userName}
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase leading-tight">
              {userRole}
            </span>
          </div>

          <button
            onClick={handleSignOut}
            className="h-[38px] w-[38px] flex items-center justify-center rounded-xl hover:bg-red-500/10 hover:text-red-400 text-slate-400 transition-colors cursor-pointer active:scale-[0.98] border border-slate-800/60"
            aria-label="Sign out"
            title="Sign out of Plantcor Enterprise"
            type="button"
          >
            <IconLogout size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
