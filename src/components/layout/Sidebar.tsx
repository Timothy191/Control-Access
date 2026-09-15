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
  IconQrcode,
  IconUsers,
  IconUserCheck,
  IconTruck,
  IconRadio,
  IconShieldLock,
} from "@tabler/icons-react";
import { ArchLinux, Vercel, Nextjs, Turborepo } from "@thesvg/react";
import BrandLogo from "@/components/common/BrandLogo";

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
    fetch("/api/tunnel").then((res) => res.json()).then((data) => { if (data?.public_url) setPublicUrl(data.public_url); }).catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    const onToggle = () => setIsOpen((prev) => !prev);
    const onOpen = () => setIsOpen(true);
    const onClose = () => setIsOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("toggle-sidebar", onToggle);
    window.addEventListener("open-sidebar", onOpen);
    window.addEventListener("close-sidebar", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("toggle-sidebar", onToggle);
      window.removeEventListener("open-sidebar", onOpen);
      window.removeEventListener("close-sidebar", onClose);
    };
  }, []);

  const navSections = [
    {
      label: "Operations",
      items: [
        { name: "Dashboard", href: "/", icon: IconDashboard },
        { name: "Scanner Terminal", href: "/scanner", icon: IconQrcode },
        { name: "Approvals", href: "/approvals", icon: IconClipboardCheck },
      ],
    },
    {
      label: "Registers & Custody",
      items: [
        { name: "Employees", href: "/employees", icon: IconUsers },
        { name: "Visitors", href: "/visitors", icon: IconUserCheck },
        { name: "Fleet", href: "/fleet", icon: IconTruck },
        { name: "Equipment", href: "/equipment", icon: IconRadio },
        { name: "Access Cards", href: "/access-cards", icon: IconIdBadge2 },
      ],
    },
    {
      label: "System & Management",
      items: [
        { name: "Device Onboarding", href: "/onboard", icon: IconDeviceMobile },
        { name: "Database", href: "/database", icon: IconDatabase },
        { name: "Admin Settings", href: "/admin", icon: IconSettings },
      ],
    },
  ];

  const triggerBtn = (
    <button
      type="button"
      onClick={() => setIsOpen((p) => !p)}
      className="hidden min-h-[48px] min-w-[48px] h-12 w-12"
      aria-label="Toggle Sidebar"
    >
      <IconMenu2 size={20} />
    </button>
  );

  return (
    <>
      {triggerBtn}
      <aside
        className={`fixed top-0 left-0 h-screen w-[285px] bg-[#090E17]/95 backdrop-blur-2xl flex flex-col transition-transform duration-400 z-35 shadow-2xl
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          border-r border-slate-800/80
        `}
        onMouseLeave={() => setIsOpen(false)}
      >
        {/* Header */}
        <div className="pt-5 px-5 pb-4 flex items-center justify-between border-b border-white/[0.08]">
          <BrandLogo size="md" subtitle="PCA-GOV-SCADA-01" />
          {/* Close button */}
          <button
            className="min-h-[48px] min-w-[48px] flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            onClick={() => setIsOpen(false)}
            aria-label="Close Sidebar"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Navigation with Semantic Sections and 48x48px Touch Targets */}
        <nav className="flex-1 overflow-y-auto py-5 px-3.5 flex flex-col gap-5 font-sans scrollbar-hide">
          {navSections.map((section) => (
            <div key={section.label} className="space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 px-3">
                {section.label}
              </div>
              <div className="flex flex-col gap-2">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative group overflow-hidden min-h-[48px] ${
                        isActive ? "text-white bg-blue-600/20 border border-blue-500/30" : "text-slate-300 hover:text-white hover:bg-white/[0.05] border border-transparent"}`}
                    >
                      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-blue-500 rounded-r-full" />}
                      <item.icon size={19} className={`shrink-0 ${isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"}`} />
                      <span className="tracking-wide text-[13px]">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer Area - Live Tunnel & Systems */}
        <div className="p-4 border-t border-white/[0.06] bg-slate-900/40 flex flex-col gap-3">
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2.5 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-mono tracking-widest text-slate-300 uppercase">Cloudflare Edge</span>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">99.98% SLA</span>
            </div>

            <div className="flex items-center justify-between bg-black/70 border border-white/10 rounded-xl overflow-hidden group min-h-[48px]">
              <div className="truncate px-3 py-2 text-[10px] text-blue-400 font-mono w-full selection:bg-blue-500/30">
                {publicUrl.replace("https://", "")}
              </div>
              {/* Copy tunnel button */}
              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[48px] min-w-[48px] flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors border-l border-white/10 shrink-0 cursor-pointer"
                aria-label="Copy Tunnel URL"
              >
                {copied ? <IconCheck size={16} className="text-emerald-400" /> : <IconCopy size={16} className="text-slate-400 group-hover:text-white" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-1">
            <span>PLANTCOR v2.4</span>
            <span>ISO 27001 / OHSAS</span>
          </div>

          <div className="flex items-center justify-center gap-3 text-neutral-600 pt-0.5">
            <span title="Arch Linux" className="hover:text-[#1793D1] transition-colors"><ArchLinux className="h-3.5 w-3.5" /></span>
            <span className="text-[8px]">•</span>
            <span title="Vercel" className="hover:text-white transition-colors"><Vercel className="h-3.5 w-3.5" /></span>
            <span className="text-[8px]">•</span>
            <span title="Next.js" className="hover:text-white transition-colors"><Nextjs className="h-3.5 w-3.5" /></span>
            <span className="text-[8px]">•</span>
            <span title="Turborepo" className="hover:opacity-100 opacity-70 transition-opacity"><Turborepo className="h-3.5 w-3.5" /></span>
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
