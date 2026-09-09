"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  IconDashboard, 
  IconQrcode, 
  IconUsers, 
  IconTruck, 
  IconDeviceDesktopAnalytics, 
  IconSettings,
  IconMenu2,
  IconX
} from "@tabler/icons-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // On desktop, we want it open by default. On mobile, closed.
    if (window.innerWidth >= 768) {
      setIsOpen(true);
    }
  }, []);

  const navItems = [
    { name: "Dashboard", href: "/", icon: IconDashboard },
    { name: "Live Scanning", href: "/kiosk", icon: IconQrcode },
    { name: "Employees", href: "/employees", icon: IconUsers },
    { name: "Fleet & Equipment", href: "/fleet", icon: IconTruck },
    { name: "Monitoring", href: "/monitoring", icon: IconDeviceDesktopAnalytics },
    { name: "Settings", href: "/settings", icon: IconSettings },
  ];

  if (!mounted) return null;

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        className="md:hidden fixed top-4 left-4 z-50 p-2 glass-card rounded-md text-text-primary"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Menu"
      >
        {isOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
      </button>

      {/* Sidebar */}
      <aside 
        className={`fixed md:sticky top-0 left-0 h-screen w-[260px] glass-card flex flex-col transition-transform duration-300 z-40
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          rounded-none border-t-0 border-l-0 border-b-0
        `}
      >
        <div className="p-6 flex items-center gap-3 border-b border-steel/30">
          <div className="w-8 h-8 rounded bg-red-primary flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(255,107,0,0.5)]">
            CA
          </div>
          <h1 className="font-display font-bold text-xl tracking-tight text-text-primary">
            CONTROL<span className="text-red-primary">-</span>ACCESS
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-all
                  ${isActive 
                    ? "bg-red-primary/10 text-red-primary border-l-2 border-red-primary" 
                    : "text-text-secondary hover:text-text-primary hover:bg-steel/10 border-l-2 border-transparent"
                  }
                `}
              >
                <item.icon size={20} className={isActive ? "text-red-primary" : ""} aria-hidden="true" />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-steel/30 text-xs text-text-secondary text-center font-mono">
          SYSTEM STATUS: <span className="text-success font-bold">ONLINE</span>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
