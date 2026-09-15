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
  IconTerminal2,
  IconShieldLock,
  IconServer2,
  IconBuildingSkyscraper,
  IconCheck,
} from "@tabler/icons-react";
import { useSite } from "@/components/layout/SiteContext";
import { getOperatorsForSite } from "@/lib/sites";
import { ArchLinux, Vercel, Nextjs, Turborepo } from "@thesvg/react";
import BrandLogo from "@/components/common/BrandLogo";

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
    <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased text-white">
      {/* Background Layer: Dark Obsidian Slate with Radial Vignette */}
      <div className="fixed inset-0 pointer-events-none bg-[#090E17]/85 z-[-1]" />
      <div className="pointer-events-none absolute inset-0 bg-cyber-grid radial-vignette opacity-40" />

      {/* Corporate Ambient Backlights */}
      <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[450px] h-[450px] bg-blue-600/10 blur-[120px] rounded-full animate-aurora-slow" />
      <div className="pointer-events-none absolute -bottom-36 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full animate-aurora-alt" />
      
      <div className="relative w-full max-w-[960px]">
        {/* Top Telemetry Strip */}
        <div className="mb-3.5 flex items-center justify-between px-2 text-[11px] font-mono tracking-tight text-slate-400">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 backdrop-blur-md shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </span>
            <span className="text-slate-200 font-medium">Cloudflare Edge Gateway • Secure</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
            <IconShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span className="tabular-nums">FIPS 140-2 • TLS 1.3 • AES-256</span>
          </div>
        </div>

        {/* Corporate Dual-Panel Portal Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0F172A]/90 backdrop-blur-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] transition-all duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
            
            {/* LEFT PANEL: Corporate Brand & Security Protocol (5 cols) */}
            <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-b from-slate-950/70 via-slate-900/50 to-slate-950/70 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
              
              <div>
                {/* Executive Brand Logo */}
                <div className="mb-6">
                  <BrandLogo size="lg" subtitle="ENTERPRISE ACCESS" />
                </div>

                <h3 className="text-xl font-bold text-white font-sans tracking-tight mb-2">
                  Critical Infrastructure Control Portal
                </h3>
                <p className="text-xs text-slate-400 font-sans leading-relaxed mb-6">
                  High-assurance ingress/egress validation, biometric dual-scan interlocks, and Chainway C66 scanner fleet coordination.
                </p>

                {/* Institutional Compliance Badges */}
                <div className="space-y-2.5 font-mono text-[11px]">
                  <div className="flex items-center gap-2.5 text-slate-300 bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-2">
                    <IconCheck size={14} className="text-emerald-400 shrink-0" />
                    <span>ISO/IEC 27001:2022 Certified</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-300 bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-2">
                    <IconCheck size={14} className="text-emerald-400 shrink-0" />
                    <span>Mine Health &amp; Safety Act (MHSA)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-300 bg-slate-900/60 border border-slate-800/80 rounded-lg px-3 py-2">
                    <IconCheck size={14} className="text-emerald-400 shrink-0" />
                    <span>Zero-Trust Device Verification</span>
                  </div>
                </div>
              </div>

              {/* Security Warning Notice */}
              <div className="mt-8 pt-4 border-t border-slate-800/80">
                <div className="text-[10px] font-mono text-slate-400 leading-relaxed">
                  <strong className="text-slate-300">AUTHORIZED PERSONNEL ONLY:</strong> All authentication sessions are cryptographically signed and committed to the immutable SQLite WAL audit journal.
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Operator Sign-In Form (7 cols) */}
            <div className="lg:col-span-7 p-6 sm:p-8 bg-[#0F172A]/70 flex flex-col justify-between">
              <div>
                {/* Form Header */}
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h4 className="text-base font-semibold text-white font-sans tracking-tight">
                      Operator Sign In
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Enter credentials for gate control clearance
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>READY</span>
                  </div>
                </div>

                {/* Segmented Control Navigation */}
                <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/80 p-1 shadow-inner">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-600/20 py-2 text-xs font-semibold text-white shadow-sm transition"
                  >
                    <IconUser size={14} className="text-blue-400" />
                    <span>Operator Login</span>
                  </button>
                  <Link
                    href="/onboard"
                    className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
                  >
                    <IconDeviceMobile size={14} />
                    <span>Onboard Kiosk</span>
                  </Link>
                </div>

                {/* Credentials Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Select Facility / Site Dropdown */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-300">
                        Assigned Facility / Site
                      </label>
                      <span className="text-[10px] font-mono text-slate-500">
                        Multi-Site Cluster
                      </span>
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-blue-400">
                        <IconMapPin size={16} />
                      </div>
                      <select
                        value={selectedSite}
                        onChange={(e) => handleSiteChange(e.target.value)}
                        className="h-11 block w-full appearance-none rounded-xl border border-slate-700/80 bg-slate-950/80 py-2 pl-9 pr-9 text-sm font-medium text-slate-100 transition duration-150 focus:border-blue-500 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        {availableSites.map((site) => (
                          <option
                            key={site.id}
                            value={site.name}
                            className="bg-[#0F172A] text-slate-100 py-1.5"
                          >
                            {site.name} {site.shortCode !== "GLOBAL" ? `(${site.shortCode})` : ""}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
                        <IconChevronDown size={15} />
                      </div>
                    </div>
                  </div>

                  {/* Operator ID Dropdown */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="operator-select" className="block text-xs font-medium text-slate-300">
                        Operator Clearance ID
                      </label>
                      <span className="text-[10px] font-mono text-slate-500">
                        {siteOperators.length} Operators Registered
                      </span>
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <IconUser size={16} />
                      </div>
                      <select
                        id="operator-select"
                        required
                        autoFocus
                        value={effectiveUsername}
                        onChange={(e) => setUsername(e.target.value)}
                        className="h-11 block w-full appearance-none rounded-xl border border-slate-700/80 bg-slate-950/80 py-2 pl-9 pr-9 text-sm font-medium text-slate-100 transition duration-150 focus:border-blue-500 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="" disabled className="bg-[#0F172A] text-slate-400">
                          -- Select Operator Clearance ID --
                        </option>
                        {siteOperators.map((op) => (
                          <option
                            key={op.id}
                            value={op.id}
                            className="bg-[#0F172A] text-slate-100 py-1.5"
                          >
                            {op.id} — {op.name} ({op.role.toUpperCase()})
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
                        <IconChevronDown size={15} />
                      </div>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-slate-300">
                        Security Password / Passcode
                      </label>
                      {capsLockActive && (
                        <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400">
                          <IconAlertCircle size={12} /> Caps Lock ON
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
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
                        className="h-11 block w-full rounded-xl border border-slate-700/80 bg-slate-950/80 py-2 pl-9 pr-10 text-sm text-slate-100 placeholder:text-slate-500 transition duration-150 focus:border-blue-500 focus:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition cursor-pointer"
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
                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition duration-150 cursor-pointer"
                      >
                        <IconKey size={14} className="text-blue-400" />
                        <span>Supply Hardware 2FA (TOTP) Token</span>
                      </button>
                    ) : (
                      <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-slate-300">
                            Two-Factor Security Code
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowTotp(false);
                              setTotp("");
                            }}
                            className="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                            <IconKey size={16} />
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="6-digit authenticator code"
                            value={totp}
                            onChange={(e) => setTotp(e.target.value)}
                            className="h-10 block w-full rounded-lg border border-slate-700/80 bg-slate-900/90 py-1.5 pl-9 pr-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error Message Callout */}
                  {error && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/50 p-3 text-xs text-red-200 backdrop-blur-sm">
                      <IconAlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                      <div className="leading-tight">{error}</div>
                    </div>
                  )}

                  {/* Primary Action Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative overflow-hidden flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all duration-150 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 shadow-[0_4px_20px_rgba(37,99,235,0.4)] cursor-pointer"
                  >
                    <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />

                    {loading ? (
                      <>
                        <IconLoader2 size={18} className="animate-spin text-white relative z-10" />
                        <span className="relative z-10">Validating Operator Credentials...</span>
                      </>
                    ) : (
                      <>
                        <span className="relative z-10 font-sans tracking-wide">Authenticate to Enterprise</span>
                        <kbd className="relative z-10 hidden sm:inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded border border-white/20 bg-white/10 font-mono text-[10px] text-white">
                          ↵
                        </kbd>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Bottom Quick Links */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Hardware Terminal Setup:</span>
                <Link
                  href="/onboard/scanner"
                  className="font-medium text-blue-400 hover:text-blue-300 hover:underline underline-offset-4 transition"
                >
                  Provision C66 Terminal →
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* Minimal Corporate System Watermark */}
        <div className="mt-3.5 flex items-center justify-between px-2 text-[11px] font-mono text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Plantcor Arch Linux Core • Station 1 // Port 8080
          </span>
          <span>Build: Next.js 16 (Turbopack) • WAL 180d</span>
        </div>

        {/* Global Tech Brand Ribbon */}
        <div className="mt-3 flex items-center justify-center gap-3 text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-1.5 hover:text-slate-300 transition-colors" title="Vercel Platform">
            <Vercel className="h-3.5 w-3.5 text-slate-400" />
            <span>Vercel</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5 hover:text-slate-300 transition-colors" title="Next.js 16">
            <Nextjs className="h-3.5 w-3.5 text-slate-400" />
            <span>Next.js 16</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5 hover:text-slate-300 transition-colors" title="Turborepo">
            <Turborepo className="h-3.5 w-3.5" />
            <span>Turborepo</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5 hover:text-[#1793D1] transition-colors" title="Arch Linux">
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
    <>
      <Link 
        href="/chat"
        className="fixed bottom-6 left-6 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/90 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)] text-white hover:bg-emerald-500/20 transition-all font-mono text-[11px] uppercase tracking-wider group"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <IconTerminal2 size={16} className="text-emerald-400" />
        <span>Enterprise AI Assistant</span>
      </Link>

      <Suspense
        fallback={
          <div className="flex min-h-screen w-full items-center justify-center bg-[#090E17]">
            <IconLoader2 size={32} className="animate-spin text-blue-500" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </>
  );
}
