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
  IconX,
  IconCopy,
  IconCheck
} from "@tabler/icons-react";
import { ArchLinux } from "@thesvg/react";
import Image from "next/image";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = "https://diamond-casino-towards-wanting.trycloudflare.com";

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    setMounted(true);
    // Auto-hide behavior: sidebar starts closed on all devices.
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
      {/* Sidebar Toggle Button (Desktop & Mobile) */}
      <button 
        className={`fixed top-4 left-4 z-50 p-2 glass-card rounded-md text-text-primary transition-all duration-300 ${
          isOpen ? "opacity-0 pointer-events-none -translate-x-4" : "opacity-100 translate-x-0"
        }`}
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setIsOpen(true)}
        aria-label="Open Menu"
      >
        <IconMenu2 size={24} />
      </button>

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-screen w-[260px] glass-card flex flex-col transition-transform duration-300 z-40
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          rounded-none border-t-0 border-l-0 border-b-0
        `}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="p-6 flex items-center justify-between border-b border-steel/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-red-primary flex items-center justify-center font-bold text-lg shadow-[0_0_15px_rgba(255,107,0,0.5)]">
              CA
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-text-primary">
              CONTROL<span className="text-red-primary">-</span>ACCESS
            </h1>
          </div>
          <button 
            className="p-1 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded transition-colors"
            onClick={() => setIsOpen(false)}
            aria-label="Close Menu"
          >
            <IconX size={20} />
          </button>
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

        <div className="p-4 border-t border-steel/30 text-xs text-text-secondary flex flex-col items-center justify-center gap-4 font-mono">
          {/* Cloudflare Tunnel Status */}
          <div className="flex flex-col items-center gap-2 w-full">
            <div className="flex items-center gap-1.5" title="Cloudflare Tunnel">
              <Image src="/assets/cloudflare.svg" alt="Cloudflare" width={16} height={16} className="opacity-90" />
              <span className="font-semibold text-text-primary text-[10px] tracking-widest uppercase">Live Tunnel</span>
            </div>
            
            <div className="flex items-center justify-between w-full bg-black/40 border border-white/10 rounded overflow-hidden group">
              <div className="truncate px-2 py-1.5 text-[9px] text-emerald-400 font-mono w-full" title={publicUrl}>
                {publicUrl.replace('https://', '')}
              </div>
              <button 
                onClick={handleCopy}
                className="p-1.5 bg-white/5 hover:bg-white/10 transition-colors border-l border-white/10 shrink-0"
                title="Copy Public URL"
              >
                {copied ? <IconCheck size={14} className="text-emerald-400" /> : <IconCopy size={14} className="group-hover:text-white" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-1.5 border-t border-white/5 pt-3 w-full">
            <div>SYSTEM STATUS: <span className="text-success font-bold">ONLINE</span></div>
            <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity mt-0.5" title="Powered by Omarchy Linux">
              <ArchLinux variant="mono" className="h-4 w-4" />
              <span>Omarchy</span>
            </div>
          </div>
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
