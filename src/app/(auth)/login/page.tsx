"use client";

import { Suspense, useState } from "react";
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
  IconArrowRight,
  IconKey,
  IconDeviceMobile,
  IconFingerprint,
} from "@tabler/icons-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [showTotp, setShowTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockActive(e.getModifierState("CapsLock"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please provide both an Operator ID and password.");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      username: username.trim(),
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
    <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Background ambient glow effect behind the card */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-red-primary/15 blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-20 right-1/4 w-[380px] h-[380px] bg-steel/10 blur-[120px] rounded-full" />

      <div className="relative w-full max-w-[440px]">
        {/* Top Floating Security Pill */}
        <div className="mb-4 flex items-center justify-between px-2 text-xs font-mono tracking-wider">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-emerald-400 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>GATEWAY ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5 text-text-secondary">
            <IconShieldCheck size={14} className="text-steel" />
            <span>256-BIT ENCRYPTED</span>
          </div>
        </div>

        {/* Main Glassmorphic Card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0d12]/85 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_35px_rgba(255,107,0,0.12)] backdrop-blur-2xl ring-1 ring-white/5 transition-all duration-300 hover:border-steel/40">
          {/* Top subtle glowing gradient accent line */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-primary to-transparent opacity-80" />

          {/* Header & Identity */}
          <div className="mb-6 flex flex-col items-center text-center">
            {/* Hexagonal / Metallic Badge */}
            <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-red-primary via-red-dark to-black p-[1px] shadow-[0_0_25px_rgba(255,107,0,0.45)]">
              <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-black/80 backdrop-blur-md">
                <IconFingerprint size={30} className="text-red-primary animate-pulse" />
              </div>
            </div>

            <h1 className="font-mono text-xl font-extrabold tracking-tight text-text-primary sm:text-2xl">
              PLANTCOR <span className="text-red-primary">ARCH</span> SYSTEM
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-widest text-text-secondary">
              Perimeter Security & Mine Site Operations
            </p>
          </div>

          {/* Quick Tab Selector */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-black/50 p-1 border border-white/5">
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 rounded-md bg-white/10 py-1.5 text-xs font-semibold text-text-primary shadow-sm"
            >
              <IconUser size={14} className="text-red-primary" />
              <span>Operator Login</span>
            </button>
            <Link
              href="/onboard"
              className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition"
            >
              <IconDeviceMobile size={14} />
              <span>Onboard Kiosk</span>
            </Link>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Operator ID Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Operator ID / Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-secondary">
                  <IconUser size={18} />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="e.g. admin or ADM001"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-lg border border-white/10 bg-black/50 py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-neutral-500 transition-colors focus:border-red-primary focus:bg-black/70 focus:outline-none focus:ring-1 focus:ring-red-primary"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Access Key / Password
                </label>
                {capsLockActive && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400">
                    <IconAlertCircle size={12} /> Caps Lock is ON
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-secondary">
                  <IconLock size={18} />
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
                  className="block w-full rounded-lg border border-white/10 bg-black/50 py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-neutral-500 transition-colors focus:border-red-primary focus:bg-black/70 focus:outline-none focus:ring-1 focus:ring-red-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-secondary hover:text-text-primary transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>

            {/* Optional 2FA Accordion */}
            <div className="pt-1">
              {!showTotp ? (
                <button
                  type="button"
                  onClick={() => setShowTotp(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-steel hover:text-amber-300 transition"
                >
                  <IconKey size={14} />
                  <span>+ Add 2FA / TOTP Security Code</span>
                </button>
              ) : (
                <div className="space-y-1.5 rounded-lg border border-steel/20 bg-black/40 p-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-steel">
                      Two-Factor (TOTP) Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTotp(false);
                        setTotp("");
                      }}
                      className="text-[11px] text-text-secondary hover:text-text-primary"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-steel">
                      <IconKey size={18} />
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="6-digit authenticator code"
                      value={totp}
                      onChange={(e) => setTotp(e.target.value)}
                      className="block w-full rounded-lg border border-steel/30 bg-black/60 py-2 pl-10 pr-3 font-mono text-sm text-text-primary placeholder:text-neutral-600 focus:border-steel focus:outline-none focus:ring-1 focus:ring-steel"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error Message Display */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200 backdrop-blur-sm animate-shake">
                <IconAlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                <div className="leading-tight">{error}</div>
              </div>
            )}

            {/* Submit CTA Button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-red-primary via-orange-600 to-red-dark py-2.5 px-4 font-medium text-white shadow-[0_0_20px_rgba(255,107,0,0.35)] transition-all duration-200 hover:shadow-[0_0_30px_rgba(255,107,0,0.55)] hover:brightness-110 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <>
                  <IconLoader2 size={18} className="animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>AUTHENTICATE & ENTER</span>
                  <IconArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </>
              )}
            </button>
          </form>

          {/* Quick Scanner Connection / Provisioning Helper */}
          <div className="mt-6 border-t border-white/5 pt-4 text-center">
            <p className="text-xs text-text-secondary">
              Configuring RFID / Chainway C66 Barcode Terminals?{" "}
              <Link
                href="/onboard"
                className="font-medium text-red-primary hover:underline hover:text-orange-400"
              >
                Launch Device Setup
              </Link>
            </p>
          </div>
        </div>

        {/* Footer System Watermark */}
        <div className="mt-4 flex items-center justify-between px-2 text-[11px] font-mono text-neutral-500">
          <span>OMARCHY LINUX 4.0</span>
          <span>PORTAL: 8080 // CLOUDFLARE QUIC</span>
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
