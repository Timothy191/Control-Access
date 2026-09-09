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
    <header className="w-full h-16 px-6 flex items-center justify-between glass-card rounded-none border-t-0 border-x-0 border-b border-steel/30 sticky top-0 z-30 mb-6">
      <div className="flex items-center gap-4 ml-12 md:ml-0">
        <h2 className="font-display font-semibold text-lg text-text-primary">
          {getPageTitle()}
        </h2>

        {/* Global Site Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-black/50 hover:bg-white/5 hover:border-white/20 text-xs font-mono text-neutral-200 transition"
            aria-label="Select Site"
          >
            <IconMapPin size={15} className="text-red-primary" />
            <span className="font-medium max-w-[140px] truncate sm:max-w-none">{selectedSite}</span>
            <IconChevronDown size={14} className="text-neutral-500" />
          </button>

          {siteDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setSiteDropdownOpen(false)}
              />
              <div className="absolute left-0 mt-1.5 w-60 rounded-xl border border-white/10 bg-[#0c0d12]/95 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.85)] backdrop-blur-xl z-50">
                <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                  Select Facility / Site
                </div>
                {availableSites.map((site) => {
                  const isSelected = selectedSite.toLowerCase() === site.name.toLowerCase();
                  return (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => handleSiteSelect(site.name)}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                        isSelected
                          ? "bg-white/10 text-white font-medium"
                          : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="font-medium text-text-primary">{site.name}</span>
                        <span className="text-[10px] text-neutral-500">{site.description}</span>
                      </div>
                      {isSelected && <IconCheck size={14} className="text-red-primary" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-text-secondary">
        <button
          className="p-2 hover:bg-steel/10 hover:text-text-primary rounded-full transition-colors relative"
          aria-label="Notifications"
          type="button"
          onClick={() => router.push("/approvals")}
        >
          <IconBell size={22} />
          {pendingApprovals !== null && pendingApprovals > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-primary text-white text-[10px] font-semibold flex items-center justify-center">
              {pendingApprovals > 9 ? "9+" : pendingApprovals}
            </span>
          )}
        </button>
        <div className="h-6 w-px bg-steel/30" />
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 hover:text-text-primary transition-colors"
          aria-label="Sign out"
          type="button"
        >
          <IconUserCircle size={26} />
          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-sm font-medium text-text-primary leading-tight">
              {userName}
            </span>
            <span className="text-xs font-mono uppercase text-text-secondary leading-tight">
              {userRole}
            </span>
          </div>
          <IconLogout size={18} className="ml-1" />
        </button>
      </div>
    </header>
  );
}
