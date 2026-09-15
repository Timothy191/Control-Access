"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useSite } from "./SiteContext";
import {
  IconBell,
  IconLogout,
  IconUserCircle,
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
} from "@tabler/icons-react";
import Link from "next/link";

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
        return "Dashboard";
      case "/employees":
        return "Employees";
      case "/visitors":
        return "Visitors";
      case "/fleet":
        return "Fleet";
      case "/equipment":
        return "Equipment";
      case "/approvals":
        return "Approvals";
      case "/database":
        return "Database";
      case "/admin":
        return "Admin Settings";
      case "/access-cards":
        return "Access Cards";
      case "/onboard":
        return "Device Onboarding";
      case "/onboard/scanner":
        return "Scanner Onboarding";
      default:
        return "Dashboard";
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

  const userName = session?.user?.name || "Signed in";
  const userRole = session?.user?.role || "user";

  const quickNavSections = [
    {
      category: "Operations",
      items: [
        { name: "Dashboard", href: "/", icon: IconDashboard },
        { name: "Scanner Terminal", href: "/scanner", icon: IconQrcode },
        { name: "Approvals & Key Control", href: "/approvals", icon: IconClipboardCheck },
      ],
    },
    {
      category: "Registers & Personnel",
      items: [
        { name: "Employees", href: "/employees", icon: IconUsers },
        { name: "Visitors", href: "/visitors", icon: IconUserCheck },
        { name: "Fleet & Earthmoving", href: "/fleet", icon: IconTruck },
        { name: "Equipment & Safety", href: "/equipment", icon: IconRadio },
        { name: "Access Cards & Badges", href: "/access-cards", icon: IconIdBadge2 },
      ],
    },
    {
      category: "System & Setup",
      items: [
        { name: "Device Onboarding", href: "/onboard", icon: IconDeviceMobile },
        { name: "Database & Backups", href: "/database", icon: IconDatabase },
        { name: "Admin Settings", href: "/admin", icon: IconSettings },
      ],
    },
  ];

  return (
    <header className="w-full h-14 px-4 sm:px-6 flex items-center justify-between backdrop-blur-2xl bg-[#141418]/80 border-b border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.05)] sticky top-0 z-20 mb-6 font-sans">
      <div className="flex items-center gap-3 sm:gap-4">
        <h2 className="font-sans font-semibold text-base text-white tracking-tight">
          {getPageTitle()}
        </h2>

        {/* Global Site Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
            className="flex items-center gap-2 h-[38px] px-3.5 py-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/25 active:scale-[0.98] text-xs font-sans text-neutral-200 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer"
            aria-label="Select Site"
          >
            <IconMapPin size={15} className="text-[#007AFF]" />
            <span className="font-medium max-w-[120px] truncate sm:max-w-none">{selectedSite}</span>
            <IconChevronDown size={14} className="text-neutral-400" />
          </button>

          {siteDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setSiteDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-white/15 bg-[#1c1c22]/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-2xl z-25">
                <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Select Facility / Site
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
                          ? "bg-[#007AFF] text-white font-medium shadow-xs"
                          : "text-neutral-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-medium">{site.name}</span>
                        <span className={`text-[10px] ${isSelected ? "text-white/80" : "text-neutral-400"}`}>
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

      <div className="flex items-center gap-2 sm:gap-3 text-neutral-300">
        <button
          className="h-[38px] w-[38px] flex items-center justify-center hover:bg-white/10 hover:text-white rounded-xl transition-colors relative cursor-pointer active:scale-[0.98] border border-transparent hover:border-white/10"
          aria-label="Notifications"
          type="button"
          onClick={() => router.push("/approvals")}
        >
          <IconBell size={19} />
          {pendingApprovals !== null && pendingApprovals > 0 && (
            <span className="absolute top-1 right-1 min-w-[15px] h-3.5 px-1 rounded-full bg-[#FF453A] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
              {pendingApprovals > 9 ? "9+" : pendingApprovals}
            </span>
          )}
        </button>

        <div className="h-4 w-px bg-white/15" />

        <button
          onClick={handleSignOut}
          className="h-[38px] flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/10 hover:text-white transition-colors cursor-pointer active:scale-[0.98] border border-transparent hover:border-white/10"
          aria-label="Sign out"
          type="button"
        >
          <IconUserCircle size={22} className="text-neutral-300" />
          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-xs font-medium text-white leading-tight">
              {userName}
            </span>
            <span className="text-[10px] font-mono uppercase text-neutral-400 leading-tight">
              {userRole}
            </span>
          </div>
          <IconLogout size={16} className="ml-1 text-neutral-400 hover:text-white" />
        </button>

        <div className="h-4 w-px bg-white/15 hidden sm:block" />

        {/* Top Right Corner Sandwich Menu Icon - Seamlessly Integrated into Top Banner */}
        <div className="relative z-30">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`h-[38px] w-[38px] flex items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer active:scale-[0.96] ${
              menuOpen
                ? "bg-[#007AFF] text-white border-[#007AFF] shadow-[0_0_12px_rgba(0,122,255,0.4)]"
                : "bg-white/[0.05] text-neutral-200 border-white/15 hover:bg-white/[0.12] hover:text-white hover:border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            }`}
            aria-label="Toggle Navigation Menu"
            title="Navigation Menu"
          >
            {menuOpen ? <IconX size={18} /> : <IconMenu2 size={18} />}
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-white/20 bg-[#141418]/95 p-3 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-3xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <IconMenu2 size={16} className="text-[#007AFF]" />
                    <span className="text-xs font-semibold text-white tracking-tight">Navigation Menu</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("open-sidebar"));
                    }}
                    className="text-[10px] font-mono text-[#007AFF] hover:text-blue-300 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 px-2 py-0.5 rounded transition cursor-pointer"
                  >
                    Open Drawer →
                  </button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                  {quickNavSections.map((sec) => (
                    <div key={sec.category} className="space-y-1">
                      <div className="px-2 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
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
                                ? "bg-[#007AFF] text-white shadow-sm"
                                : "text-neutral-200 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <Icon size={16} className={active ? "text-white" : "text-neutral-400"} />
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
      </div>
    </header>
  );
}
