"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconDeviceMobile,
  IconClipboardCheck,
  IconDatabase,
  IconSettings,
  IconMenu2,
  IconX,
  IconCopy,
  IconCheck,
  IconIdBadge2,
  IconQrcode
} from "@tabler/icons-react";
import { ArchLinux, Vercel, Nextjs, Turborepo } from "@thesvg/react";
import Image from "next/image";


export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publicUrl, setPublicUrl] = useState("https://plantcor-access.cloudflare.com");

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetch("/api/tunnel")
      .then((res) => res.json())
      .then((data) => {
        if (data?.public_url) setPublicUrl(data.public_url);
      })
      .catch(() => {});

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navItems = [
    { name: "Dashboard", href: "/", icon: IconDashboard },
    { name: "Onboarding", href: "/onboard", icon: IconDeviceMobile },
    { name: "Access Cards", href: "/access-cards", icon: IconIdBadge2 },
    { name: "Scanner", href: "/scanner", icon: IconQrcode },
    { name: "Approvals", href: "/approvals", icon: IconClipboardCheck },
    { name: "Database", href: "/database", icon: IconDatabase },
    { name: "Admin Settings", href: "/admin", icon: IconSettings },
  ];

  return (
    <>
      <button
        className={`fixed top-5 left-5 z-50 p-2.5 backdrop-blur-md bg-black/40 border border-white/10 rounded-xl text-neutral-300 transition-all duration-300 hover:text-white hover:bg-white/10 ${
          isOpen ? "opacity-0 pointer-events-none -translate-x-4" : "opacity-100 translate-x-0"
        }`}
        onClick={() => setIsOpen(true)}
        aria-label="Open Menu"
      >
        <IconMenu2 size={20} />
      </button>

      <aside
        className={`fixed top-0 left-0 h-screen w-[280px] bg-[#0A0A0A]/80 backdrop-blur-2xl flex flex-col transition-transform duration-400 z-40 shadow-2xl
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          border-r border-white/[0.08]
        `}
        onMouseLeave={() => setIsOpen(false)}
      >
        {/* Modern Header */}
        <div className="pt-6 px-6 pb-5 flex items-center justify-between border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1793D1]/20 to-transparent border border-[#1793D1]/30 flex items-center justify-center shadow-lg shadow-[#1793D1]/10">
              <ArchLinux className="h-5 w-5 text-[#1793D1]" />
            </div>
            <div>
              <h1 className="font-sans font-semibold text-[15px] tracking-tight text-white leading-tight flex items-center gap-1.5">
                PLANTCOR
                <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent font-bold">
                  ARCH
                </span>
              </h1>
              <span className="text-[11px] font-mono text-neutral-500 tracking-widest uppercase">
                Access Node
              </span>
            </div>
          </div>
          <button
            className="p-1.5 text-neutral-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1.5 font-sans scrollbar-hide">
          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 px-2 mb-2">Main Menu</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group overflow-hidden
                  ${
                    isActive
                      ? "text-white bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/5"
                      : "text-neutral-400 hover:text-neutral-100 hover:bg-white/[0.04] border border-transparent"
                  }
                `}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                )}
                <item.icon
                  size={18}
                  className={`transition-colors ${isActive ? "text-blue-400" : "text-neutral-500 group-hover:text-neutral-300"}`}
                />
                <span className="tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Area - System Status */}
        <div className="p-5 border-t border-white/[0.04] bg-white/[0.01] flex flex-col gap-4">
          <div className="bg-black/40 border border-white/[0.06] rounded-xl p-3 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">Live Tunnel</span>
            </div>

            <div className="flex items-center justify-between bg-black/60 border border-white/5 rounded-lg overflow-hidden group">
              <div className="truncate px-2.5 py-2 text-[10px] text-blue-400/90 font-mono w-full selection:bg-blue-500/30">
                {publicUrl.replace("https://", "")}
              </div>
              <button
                onClick={handleCopy}
                className="p-2 bg-white/5 hover:bg-white/10 transition-colors border-l border-white/5 shrink-0"
              >
                {copied ? <IconCheck size={14} className="text-emerald-400" /> : <IconCopy size={14} className="text-neutral-400 group-hover:text-white" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 text-neutral-600 pt-1">
            <span title="Arch Linux" className="hover:text-[#1793D1] transition-colors"><ArchLinux className="h-4 w-4" /></span>
            <span className="text-[8px]">•</span>
            <span title="Vercel" className="hover:text-white transition-colors"><Vercel className="h-4 w-4" /></span>
            <span className="text-[8px]">•</span>
            <span title="Next.js" className="hover:text-white transition-colors"><Nextjs className="h-4 w-4" /></span>
            <span className="text-[8px]">•</span>
            <span title="Turborepo" className="hover:opacity-100 opacity-70 transition-opacity"><Turborepo className="h-4 w-4" /></span>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
