"use client";

import { Suspense, useState, useMemo } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  IconLock,
  IconUser,
  IconShieldCheck,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconLoader2,
  IconKey,
  IconDeviceMobile,
  IconMapPin,
  IconChevronDown,
  IconTerminal2
} from "@tabler/icons-react";
import { useSite } from "@/components/layout/SiteContext";
import { getOperatorsForSite } from "@/lib/sites";
import { ArchLinux, Vercel, Nextjs, Turborepo } from "@thesvg/react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { selectedSite, setSelectedSite, availableSites } = useSite();
  const siteOperators = useMemo(() => getOperatorsForSite(selectedSite), [selectedSite]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showTotp, setShowTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const effectiveUsername = siteOperators.some((op) => op.id === username) ? username : "";

  const handleSiteChange = (newSite: string) => {
    setSelectedSite(newSite);
    const newOps = getOperatorsForSite(newSite);
    if (username && !newOps.some((op) => op.id === username)) {
      setUsername("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState("CapsLock"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveUsername.trim() || !password) {
      setError("Please provide both an Operator ID and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      username: effectiveUsername.trim(),
      password,
      totp: totp.trim() || undefined,
      redirect: false,
    });

    if (res?.error) {
      setError("Authentication failed. Check your ID, password, or 2FA code.");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* High-tech Cyber Grid & Ambient Vignette Background */}
      <div className="pointer-events-none absolute inset-0 bg-cyber-grid radial-vignette opacity-70" />

      {/* Dual Dynamic Floating Aurora Orbs */}
      <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-orange-500/20 via-red-primary/10 to-transparent blur-[140px] rounded-full animate-aurora-slow" />
      <div className="pointer-events-none absolute -bottom-36 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-emerald-500/10 via-cyan-500/5 to-transparent blur-[130px] rounded-full animate-aurora-alt" />
      {/* AI Agent Dev Access Link */}
      <Link 
        href="/chat"
        className="absolute bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 text-neutral-400 hover:text-white hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all font-mono text-[10px] uppercase tracking-wider group"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
        <IconTerminal2 size={14} className="group-hover:text-emerald-400 transition-colors" />
        <span className="group-hover:text-emerald-400 transition-colors">AI Console</span>
      </Link>

      <div className="relative w-full max-w-[430px]">
        {/* Status Bar Header */}
        <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-mono tracking-tight text-neutral-400">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/80 px-2.5 py-0.5 backdrop-blur-md shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </span>
            <span className="text-neutral-200 font-medium">Gateway Node Active</span>
          </div>

          <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-[11px]">
            <IconShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span className="tabular-nums">TLS 1.3 • AES-256</span>
          </div>
        </div>

        {/* macOS Window Card with Acrylic Vibrancy & Traffic Lights */}
        <div className="mac-window relative overflow-hidden rounded-2xl border border-white/[0.14] transition-all duration-300">
          {/* macOS Titlebar */}
          <div className="mac-titlebar px-4 py-3 flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02]">
            {/* Window Controls (Traffic Lights) */}
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center group cursor-pointer" title="Close">
                <span className="text-[8px] leading-none text-black/70 font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕</span>
              </div>
              <div className="h-3 w-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center group cursor-pointer" title="Minimize">
                <span className="text-[8px] leading-none text-black/70 font-bold opacity-0 group-hover:opacity-100 transition-opacity">−</span>
              </div>
              <div className="h-3 w-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center group cursor-pointer" title="Zoom">
                <span className="text-[8px] leading-none text-black/70 font-bold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
              </div>
            </div>

            {/* Window Document Title & Proxy Icon */}
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-300 font-sans tracking-tight">
              <ArchLinux className="h-3.5 w-3.5 text-[#1793D1]" />
              <span>Plantcor Arch — Gateway</span>
            </div>

            {/* Window Right Status Pill */}
            <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>ONLINE</span>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            {/* Biometric Identity & Arch Linux Site Logo */}
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="relative mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1793D1]/40 bg-gradient-to-b from-[#1793D1]/20 via-white/[0.04] to-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_0_24px_rgba(23,147,209,0.35)] overflow-hidden">
                {/* Outer pulsing glow ring */}
                <div className="pointer-events-none absolute -inset-1 rounded-2xl border border-[#1793D1]/30 animate-pulse-ring" />

                {/* Animated Laser Scanline Effect */}
                <div className="pointer-events-none absolute inset-x-1 h-[2px] bg-gradient-to-r from-transparent via-[#1793D1] to-transparent shadow-[0_0_10px_rgba(23,147,209,1)] z-20 animate-scan-line" />

                {/* Arch Linux Official Site Logo */}
                <ArchLinux className="h-8 w-8 text-[#1793D1] relative z-10 drop-shadow-[0_0_10px_rgba(23,147,209,0.8)]" />
              </div>

              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl font-sans">
                Plantcor <span className="text-[#007AFF] font-bold">Arch</span> System
              </h1>
              <p className="mt-1 text-xs text-neutral-400 tracking-normal font-sans">
                Perimeter Access & Control Gateway
              </p>
            </div>

            {/* macOS Segmented Control (Tabs) */}
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-black/40 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.14] py-1.5 text-xs font-medium text-white shadow-[0_1px_3px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] transition"
              >
                <IconUser size={14} className="text-neutral-200" />
                <span>Operator Login</span>
              </button>
              <Link
                href="/onboard"
                className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition"
              >
                <IconDeviceMobile size={14} />
                <span>Onboard Kiosk</span>
              </Link>
            </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Operator ID Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="operator-select" className="block text-xs font-medium text-neutral-300">
                  Operator ID or Username
                </label>
                <span className="text-[10px] font-mono text-neutral-500">
                  {siteOperators.length} Available
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                  <IconUser size={16} />
                </div>
                <select
                  id="operator-select"
                  required
                  autoFocus
                  value={effectiveUsername}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-10 block w-full appearance-none rounded-md border border-white/10 bg-black/60 py-2 pl-9 pr-9 text-sm font-medium text-neutral-100 transition duration-150 ease-out focus:border-white/40 focus:bg-black/80 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                >
                  <option value="" disabled className="bg-neutral-900 text-neutral-500">
                    -- Select Operator ID or Username --
                  </option>
                  {siteOperators.map((op) => (
                    <option
                      key={op.id}
                      value={op.id}
                      className="bg-neutral-900 text-neutral-200 py-1"
                    >
                      {op.id} — {op.name} ({op.role})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500">
                  <IconChevronDown size={15} />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-300">
                  Password
                </label>
                {capsLockActive && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400">
                    <IconAlertCircle size={12} /> Caps Lock is ON
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                  <IconLock size={16} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyDown}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 block w-full rounded-md border border-white/10 bg-black/50 py-2 pl-9 pr-10 text-sm text-neutral-100 placeholder:text-neutral-600 transition duration-150 ease-out focus:border-white/40 focus:bg-black/70 focus:outline-none focus:ring-1 focus:ring-white/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-neutral-300 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {/* Collapsible 2FA Accordion */}
            <div className="pt-0.5">
              {!showTotp ? (
                <button
                  type="button"
                  onClick={() => setShowTotp(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition duration-150"
                >
                  <IconKey size={14} className="text-neutral-500" />
                  <span>Use Two-Factor (TOTP) Key</span>
                </button>
              ) : (
                <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/40 p-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-neutral-300">
                      Two-Factor Security Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTotp(false);
                        setTotp("");
                      }}
                      className="text-[11px] text-neutral-500 hover:text-neutral-300"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                      <IconKey size={16} />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="6-digit code"
                      value={totp}
                      onChange={(e) => setTotp(e.target.value)}
                      className="h-9 block w-full rounded-md border border-white/10 bg-black/60 py-1.5 pl-9 pr-3 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/30"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Select Facility / Site Dropdown (at bottom of panel) */}
            <div className="space-y-1.5 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-300">
                  Select Facility / Site
                </label>
                <span className="text-[10px] font-mono text-neutral-500">
                  Filters Database & ID
                </span>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-red-primary">
                  <IconMapPin size={16} />
                </div>
                <select
                  value={selectedSite}
                  onChange={(e) => handleSiteChange(e.target.value)}
                  className="h-10 block w-full appearance-none rounded-md border border-white/10 bg-black/60 py-2 pl-9 pr-9 text-sm font-medium text-neutral-100 transition duration-150 ease-out focus:border-white/40 focus:bg-black/80 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                >
                  {availableSites.map((site) => (
                    <option
                      key={site.id}
                      value={site.name}
                      className="bg-neutral-900 text-neutral-200 py-1"
                    >
                      {site.name} {site.shortCode !== "ALL" ? `(${site.shortCode})` : ""}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500">
                  <IconChevronDown size={15} />
                </div>
              </div>
            </div>

            {/* Error Message Callout */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-xs text-red-200 backdrop-blur-sm">
                <IconAlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                <div className="leading-tight">{error}</div>
              </div>
            )}

            {/* Primary Action Button - macOS Blue Push Button */}
            <button
              type="submit"
              disabled={loading}
              className="mac-button-primary group relative overflow-hidden flex h-10 w-full items-center justify-center gap-2 rounded-lg text-white font-medium text-sm transition-all duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {/* Shimmer Light Reflection */}
              <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />

              {loading ? (
                <>
                  <IconLoader2 size={16} className="animate-spin text-white/90 relative z-10" />
                  <span className="relative z-10">Authenticating...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10 font-sans">Sign In to System</span>
                  <kbd className="relative z-10 hidden sm:inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded border border-white/30 bg-white/20 font-mono text-[10px] text-white">
                    ↵
                  </kbd>
                </>
              )}
            </button>
          </form>

          {/* Quick Scanner Helper */}
          <div className="mt-5 border-t border-white/5 pt-4 text-center">
            <p className="text-xs text-neutral-400">
              Need hardware scanner setup?{" "}
              <Link
                href="/onboard"
                className="font-medium text-[#007AFF] hover:underline underline-offset-4 transition"
              >
                Provision Scanner
              </Link>
            </p>
          </div>
        </div>
      </div>

        {/* Minimal System Watermark with Live Beacon */}
        <div className="mt-3 flex items-center justify-between px-1 text-[11px] font-mono text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90 animate-pulse" />
            Omarchy Linux 4.0
          </span>
          <span>Station 1 // Port 8080</span>
        </div>

        {/* Global Vercel & Arch Branding Ribbon */}
        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] font-mono text-neutral-500">
          <div className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors cursor-help" title="Vercel Platform">
            <Vercel className="h-3.5 w-3.5 text-white" />
            <span>Vercel</span>
          </div>
          <span className="text-neutral-700">•</span>
          <div className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors cursor-help" title="Next.js 16 (Turbopack Engine)">
            <Nextjs className="h-3.5 w-3.5 text-white" />
            <span>Next.js 16</span>
          </div>
          <span className="text-neutral-700">•</span>
          <div className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors cursor-help" title="Turborepo Monorepo & Build System">
            <Turborepo className="h-3.5 w-3.5" />
            <span>Turborepo</span>
          </div>
          <span className="text-neutral-700">•</span>
          <div className="flex items-center gap-1.5 hover:text-[#1793D1] transition-colors cursor-help" title="Arch Linux Operating System">
            <ArchLinux className="h-3.5 w-3.5 text-[#1793D1]" />
            <span>Arch Linux</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center">
          <IconLoader2 size={32} className="animate-spin text-red-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
