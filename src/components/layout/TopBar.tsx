"use client";

import { usePathname } from "next/navigation";
import { IconBell, IconUserCircle } from "@tabler/icons-react";

export default function TopBar() {
  const pathname = usePathname();
  
  const getPageTitle = () => {
    switch (pathname) {
      case "/": return "Dashboard";
      case "/kiosk": return "Live Scanning";
      case "/employees": return "Employees";
      case "/fleet": return "Fleet & Equipment";
      case "/monitoring": return "Monitoring Wallboard";
      case "/settings": return "Settings";
      default: return "Dashboard";
    }
  };

  return (
    <header className="w-full h-16 px-6 flex items-center justify-between glass-card rounded-none border-t-0 border-x-0 border-b border-steel/30 sticky top-0 z-30 mb-6">
      <div className="flex items-center gap-4 ml-12 md:ml-0">
        <h2 className="font-display font-semibold text-lg text-text-primary">
          {getPageTitle()}
        </h2>
        {/* Mock Live Indicator */}
        {pathname === "/monitoring" && (
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-red-primary/10 border border-red-primary/30">
            <div className="w-2 h-2 rounded-full bg-red-primary animate-pulse" />
            <span className="text-xs font-mono font-medium text-red-primary">LIVE</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-text-secondary">
        <button className="p-2 hover:bg-steel/10 hover:text-text-primary rounded-full transition-colors relative" aria-label="Notifications">
          <IconBell size={22} />
          <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-primary" />
        </button>
        <div className="h-6 w-px bg-steel/30" />
        <button className="flex items-center gap-2 hover:text-text-primary transition-colors" aria-label="User Profile">
          <IconUserCircle size={26} />
          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-sm font-medium text-text-primary leading-tight">Admin User</span>
            <span className="text-xs font-mono text-text-secondary leading-tight">ID: ADMIN-01</span>
          </div>
        </button>
      </div>
    </header>
  );
}
