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
} from "@tabler/icons-react";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { selectedSite, setSelectedSite, availableSites } = useSite();
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
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
      case "/onboard":
        return "Device Onboarding";
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

  return (
    <header className="w-full h-14 px-6 flex items-center justify-between backdrop-blur-2xl bg-[#141418]/75 border-b border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.05)] sticky top-0 z-30 mb-6 font-sans">
      <div className="flex items-center gap-4 ml-12 md:ml-0">
        <h2 className="font-sans font-semibold text-base text-white tracking-tight">
          {getPageTitle()}
        </h2>

        {/* Global Site Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/25 text-xs font-sans text-neutral-200 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] cursor-pointer"
            aria-label="Select Site"
          >
            <IconMapPin size={14} className="text-[#007AFF]" />
            <span className="font-medium max-w-[140px] truncate sm:max-w-none">{selectedSite}</span>
            <IconChevronDown size={13} className="text-neutral-400" />
          </button>

          {siteDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setSiteDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-2 w-64 rounded-xl border border-white/15 bg-[#1c1c22]/95 p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-2xl z-50">
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

      <div className="flex items-center gap-3 text-neutral-300">
        <button
          className="p-2 hover:bg-white/10 hover:text-white rounded-lg transition-colors relative cursor-pointer"
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
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
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
      </div>
    </header>
  );
}
