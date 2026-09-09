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
    <div className="relative z-10 flex min-h-screen w-full items-center justify-center p-4 sm:p-6 lg:p-8 font-sans antialiased">
      {/* Subtle Geist ambient glow background */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-gradient-to-b from-orange-500/10 via-red-primary/5 to-transparent blur-[140px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 w-[400px] h-[400px] bg-white/[0.02] blur-[120px] rounded-full" />

      <div className="relative w-full max-w-[420px]">
        {/* Geist Status Bar Header */}
        <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-mono tracking-tight text-neutral-400">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/70 px-2.5 py-0.5 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            </span>
            <span className="text-neutral-200 font-medium">Gateway Online</span>
          </div>

          <div className="flex items-center gap-1.5 text-neutral-400">
            <IconShieldCheck size={14} className="text-emerald-400" />
            <span className="tabular-nums">TLS 1.3 • AES-256</span>
          </div>
        </div>

        {/* Geist Elevated Surface Card */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0c]/85 p-6 sm:p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_16px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all duration-200 hover:border-white/15">
          {/* Top Hairline Sheen (Vercel signature) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Identity & Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
              <IconFingerprint size={26} className="text-white" />
            </div>

            <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl font-sans">
              Plantcor <span className="text-red-primary font-bold">Arch</span> System
            </h1>
            <p className="mt-1 text-xs text-neutral-400 tracking-normal">
              Perimeter Access & Control Gateway
            </p>
          </div>

          {/* Geist Segmented Control (Tabs) */}
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/60 p-1">
            <button
              type="button"
              className="flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-neutral-800/90 py-1.5 text-xs font-medium text-white shadow-xs transition"
            >
              <IconUser size={14} className="text-neutral-300" />
              <span>Operator Login</span>
            </button>
            <Link
              href="/onboard"
              className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition"
            >
              <IconDeviceMobile size={14} />
              <span>Onboard Kiosk</span>
            </Link>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Operator ID Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-300">
                Operator ID or Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                  <IconUser size={16} />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="admin or employee ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-10 block w-full rounded-md border border-white/10 bg-black/50 py-2 pl-9 pr-3 text-sm text-neutral-100 placeholder:text-neutral-600 transition duration-150 ease-out focus:border-white/40 focus:bg-black/70 focus:outline-none focus:ring-1 focus:ring-white/30"
                />
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

            {/* Error Message Callout */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-xs text-red-200 backdrop-blur-sm">
                <IconAlertCircle size={16} className="shrink-0 text-red-400 mt-0.5" />
                <div className="leading-tight">{error}</div>
              </div>
            )}

            {/* Geist Primary Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="group relative flex h-10 w-full items-center justify-center gap-2 rounded-md bg-white text-black font-medium text-sm shadow-[0_1px_2px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.15)] transition-all duration-150 ease-out hover:bg-neutral-200 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? (
                <>
                  <IconLoader2 size={16} className="animate-spin text-neutral-600" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to System</span>
                  <kbd className="hidden sm:inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded border border-neutral-300 bg-neutral-100 font-mono text-[10px] text-neutral-600">
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
                className="font-medium text-white hover:underline underline-offset-4 transition"
              >
                Provision Scanner
              </Link>
            </p>
          </div>
        </div>

        {/* Geist Minimal System Watermark */}
        <div className="mt-3 flex items-center justify-between px-1 text-[11px] font-mono text-neutral-500">
          <span>Omarchy Linux 4.0</span>
          <span>Station 1 // 8080</span>
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
