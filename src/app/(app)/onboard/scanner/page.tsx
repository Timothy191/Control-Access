import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminZeroTouchSection from "@/components/admin/AdminZeroTouchSection";
import C66LiveVerificationCard from "@/components/onboard/C66LiveVerificationCard";
import C66ApkDownloadCard from "@/components/onboard/C66ApkDownloadCard";
import { getTunnelUrl } from "@/lib/tunnel";
import {
  IconArrowLeft,
  IconDeviceMobile,
  IconExternalLink,
  IconTools,
  IconKeyboard,
  IconScan,
  IconInfoCircle,
} from "@tabler/icons-react";

export const dynamic = "force-dynamic";

export default async function ScannerOnboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/onboard/scanner")}`);
  }

  const tunnelUrl = await getTunnelUrl();
  const serverUrl = process.env.BASE_URL || "http://127.0.0.1:8080";

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/onboard"
              className="text-xs text-neutral-400 hover:text-white transition flex items-center gap-1 font-mono"
            >
              <IconArrowLeft size={14} />
              <span>Back to Onboarding Hub</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Chainway C66 RFID Scanner Onboarding &amp; PC Link
          </h1>
          <p className="text-xs text-neutral-400 font-mono mt-1">
            Download pre-configured Android companion app, pair rugged C66 handheld terminals, and monitor live scans on this screen.
          </p>
        </div>

        <Link
          href="/scanner"
          target="_blank"
          className="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] active:scale-[0.98] text-white text-xs font-semibold font-mono flex items-center gap-2 transition shadow-lg shadow-[#007AFF]/25 self-start sm:self-auto"
        >
          <IconDeviceMobile size={18} />
          <span>Launch C66 Fullscreen Kiosk</span>
          <IconExternalLink size={14} />
        </Link>
      </div>

      {/* 1. Android Companion APK Download & Direct Setup Card */}
      <C66ApkDownloadCard tunnelUrl={tunnelUrl} />

      {/* 2. Live PC Screen Tap Verification Console */}
      <C66LiveVerificationCard tunnelUrl={tunnelUrl} />

      {/* 2. Zero-Touch QR Setup Generator */}
      <AdminZeroTouchSection
        serverUrl={serverUrl}
        tunnelUrl={tunnelUrl}
        defaultGate="GATE-MAIN-01"
      />

      {/* 3. Chainway C66 Hardware Configuration & Troubleshooting Guide */}
      <div className="glass-card p-6 border border-white/10 space-y-5">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
            <IconTools size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Chainway C66 Hardware Trigger &amp; RFID Setup Guide
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Configure the C66&apos;s physical trigger buttons and broadcast wedge so scans stream directly to this PC.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-mono text-xs">
          {/* Step 1: Why Scans Weren't Appearing on PC */}
          <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-[#007AFF] font-bold">
              <IconInfoCircle size={16} />
              <span>1. Why Scans Were Dropped</span>
            </div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              Out of the box, the C66&apos;s RFID reader only emits local virtual keystrokes. Without an active web link or broadcast listener, tags were dropped. The Control-Access system now features a <strong>global hardware wedge catcher</strong> and <strong>live SSE broadcast bus</strong> that automatically sends all RFID tags straight to this screen.
            </p>
          </div>

          {/* Step 2: C66 KeyboardEmulator Configuration */}
          <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold">
              <IconKeyboard size={16} />
              <span>2. C66 Built-in App Settings</span>
            </div>
            <ul className="text-neutral-400 text-[11px] space-y-1.5 list-disc list-inside">
              <li>Open the C66&apos;s factory <strong>KeyboardEmulator</strong> app.</li>
              <li>Under <strong>Function</strong>, enable <strong>Barcode/UHF</strong>.</li>
              <li>Under <strong>Scan Keycode</strong>, ensure <strong>139</strong> (Pistol Grip Trigger) or <strong>280</strong> is active.</li>
              <li>Under <strong>End char</strong>, select <strong>Enter (\n)</strong>.</li>
              <li>Under <strong>Output Mode</strong>, select <strong>Direct KeyStroke</strong> or <strong>Broadcast Intent</strong>.</li>
            </ul>
          </div>

          {/* Step 3: Trigger Buttons & Screen Overlay */}
          <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <IconScan size={16} />
              <span>3. Trigger Buttons &amp; Overlay</span>
            </div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              When using the C66 scanner interface (at <code className="text-white">/scanner</code>), you have two trigger methods:
            </p>
            <ul className="text-neutral-400 text-[11px] space-y-1.5 list-disc list-inside">
              <li><strong>Physical Trigger:</strong> Pull the C66 pistol grip trigger (KeyCode 139) or yellow side buttons.</li>
              <li><strong>Floating Screen Overlay:</strong> Tap the blue on-screen <strong>&quot;SCAN RFID / BARCODE&quot;</strong> button designed for heavy industrial mining gloves.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
