"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconDashboard,
  IconQrcode,
  IconDeviceMobile,
  IconUsers,
  IconTruck,
  IconTool,
  IconClipboardCheck,
  IconDatabase,
  IconSettings,
  IconMenu2,
  IconX,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";
import { ArchLinux, Vercel, Nextjs, Turborepo } from "@thesvg/react";
import Image from "next/image";

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = "https://diamond-casino-towards-wanting.trycloudflare.com";

  const handleCopy = () => {
    navigator.clipboard.writeText(publicUrl).catch(() => {
      // clipboard unavailable (non-secure context); copied state stays false
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navItems = [
    { name: "Dashboard", href: "/", icon: IconDashboard },
    { name: "Employees", href: "/employees", icon: IconUsers },
    { name: "Visitors", href: "/visitors", icon: IconQrcode },
    { name: "Onboarding", href: "/onboard", icon: IconDeviceMobile },
    { name: "Fleet", href: "/fleet", icon: IconTruck },
    { name: "Equipment", href: "/equipment", icon: IconTool },
    { name: "Approvals", href: "/approvals", icon: IconClipboardCheck },
    { name: "Database", href: "/database", icon: IconDatabase },
    { name: "Admin Settings", href: "/admin", icon: IconSettings },
  ];

  return (
    <>
      {/* Sidebar Toggle Button (Desktop & Mobile) */}
      <button
        className={`fixed top-4 left-4 z-50 p-2 glass-card rounded-md text-text-primary transition-all duration-300 ${
          isOpen
            ? "opacity-0 pointer-events-none -translate-x-4"
            : "opacity-100 translate-x-0"
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
            <div className="w-9 h-9 rounded-lg bg-black/70 border border-[#1793D1]/40 flex items-center justify-center shadow-[0_0_16px_rgba(23,147,209,0.35)] shrink-0">
              <ArchLinux className="h-5 w-5 text-[#1793D1]" />
            </div>
            <div>
              <h1 className="font-display font-bold text-base tracking-tight text-text-primary leading-tight">
                PLANTCOR <span className="text-red-primary font-extrabold">ARCH</span>
              </h1>
              <span className="text-[10px] font-mono text-neutral-400 tracking-wider uppercase block">
                Control-Access
              </span>
            </div>
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
                  ${
                    isActive
                      ? "bg-red-primary/10 text-red-primary border-l-2 border-red-primary"
                      : "text-text-secondary hover:text-text-primary hover:bg-steel/10 border-l-2 border-transparent"
                  }
                `}
              >
                <item.icon
                  size={20}
                  className={isActive ? "text-red-primary" : ""}
                  aria-hidden="true"
                />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-steel/30 text-xs text-text-secondary flex flex-col items-center justify-center gap-4 font-mono">
          {/* Cloudflare Tunnel Status */}
          <div className="flex flex-col items-center gap-2 w-full">
            <div
              className="flex items-center gap-1.5"
              title="Cloudflare Tunnel"
            >
              <Image
                src="/assets/cloudflare.svg"
                alt="Cloudflare"
                width={16}
                height={16}
                className="opacity-90"
              />
              <span className="font-semibold text-text-primary text-[10px] tracking-widest uppercase">
                Live Tunnel
              </span>
            </div>

            <div className="flex items-center justify-between w-full bg-black/40 border border-white/10 rounded overflow-hidden group">
              <div
                className="truncate px-2 py-1.5 text-[9px] text-emerald-400 font-mono w-full"
                title={publicUrl}
              >
                {publicUrl.replace("https://", "")}
              </div>
              <button
                onClick={handleCopy}
                className="p-1.5 bg-white/5 hover:bg-white/10 transition-colors border-l border-white/10 shrink-0"
                title="Copy Public URL"
              >
                {copied ? (
                  <IconCheck size={14} className="text-emerald-400" />
                ) : (
                  <IconCopy size={14} className="group-hover:text-white" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-3 w-full">
            <div className="text-xs font-mono">
              SYSTEM STATUS:{" "}
              <span className="text-success font-bold">ONLINE</span>
            </div>
            {/* Global Branding Suite */}
            <div className="flex flex-col items-center gap-1.5 w-full pt-1">
              <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
                Ecosystem & Base
              </span>
              <div className="flex items-center justify-center gap-2 text-neutral-400 py-1.5 px-2 rounded-md bg-white/[0.03] border border-white/10 w-full">
                <span title="Arch Linux (System Base)" className="hover:text-[#1793D1] transition-colors cursor-help">
                  <ArchLinux className="h-3.5 w-3.5 text-[#1793D1]" />
                </span>
                <span className="text-neutral-600 text-[10px]">•</span>
                <span title="Vercel Platform" className="hover:text-white transition-colors cursor-help">
                  <Vercel className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-neutral-600 text-[10px]">•</span>
                <span title="Next.js 16 (Turbopack)" className="hover:text-white transition-colors cursor-help">
                  <Nextjs className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="text-neutral-600 text-[10px]">•</span>
                <span title="Turborepo Monorepo & Build System" className="hover:opacity-100 transition-opacity cursor-help">
                  <Turborepo className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setIsOpen(false)}
          role="presentation"
        />
      )}
    </>
  );
}
