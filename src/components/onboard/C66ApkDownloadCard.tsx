"use client";

import { useState } from "react";
import PremiumQRCode from "./PremiumQRCode";
import {
  IconBrandAndroid,
  IconDownload,
  IconCheck,
  IconCopy,
  IconCloud,
  IconWifi,
  IconShieldCheck,
  IconSparkles,
  IconExternalLink,
  IconDeviceMobile,
  IconBolt,
} from "@tabler/icons-react";

interface C66ApkDownloadCardProps {
  tunnelUrl: string;
  serverIp?: string;
  serverPort?: string;
}

export default function C66ApkDownloadCard({
  tunnelUrl,
  serverIp = "127.0.0.1",
  serverPort = "8080",
}: C66ApkDownloadCardProps) {
  const [networkMode, setNetworkMode] = useState<"public" | "lan">("public");
  const [copied, setCopied] = useState(false);

  const baseUrl =
    networkMode === "public" && tunnelUrl
      ? tunnelUrl
      : `http://${serverIp}:${serverPort}`;

  const downloadUrl = `${baseUrl}/downloads/c66-scanner-bridge.apk`;
  const apiDownloadUrl = `${baseUrl}/api/downloads/c66-apk`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(downloadUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card rounded-2xl border border-emerald-500/30 bg-[#121815]/80 backdrop-blur-2xl p-6 relative overflow-hidden shadow-2xl space-y-6">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-start gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
            <IconBrandAndroid size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                Native Handheld Bridge APK
              </span>
              <span className="text-[10px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-black/40 border border-white/10">
                v2.1.0-industrial
              </span>
              <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25">
                Pre-configured Link
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight mt-1.5 flex items-center gap-2">
              Chainway C66 Android Companion App (.APK)
            </h2>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              Install directly onto Chainway C66 to activate hardware pistol grip triggers, floating glove overlay, and real-time PC scan sync.
            </p>
          </div>
        </div>

        {/* Network Mode Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/60 border border-white/10 text-[11px] font-mono self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setNetworkMode("public")}
            className={`py-1.5 px-3 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              networkMode === "public"
                ? "bg-emerald-600 text-white font-semibold shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconCloud size={13} />
            <span>Cloudflare Tunnel</span>
          </button>
          <button
            type="button"
            onClick={() => setNetworkMode("lan")}
            className={`py-1.5 px-3 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              networkMode === "lan"
                ? "bg-emerald-600 text-white font-semibold shadow-xs"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <IconWifi size={13} />
            <span>Local Site Wi-Fi</span>
          </button>
        </div>
      </div>

      {/* Main Grid: QR Code & Download Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: Direct QR Download (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col items-center text-center p-5 rounded-xl bg-black/50 border border-white/10 space-y-4">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-neutral-300 font-bold flex items-center justify-center gap-1.5">
              <IconSparkles size={14} className="text-emerald-400" />
              <span>Scan QR with C66 Camera to Download</span>
            </span>
            <p className="text-[10px] text-neutral-400 font-mono max-w-xs">
              Open the C66 camera or browser, point at this QR code to download the installable APK instantly.
            </p>
          </div>

          <div className="p-2.5 rounded-2xl bg-white shadow-xl">
            <PremiumQRCode
              value={downloadUrl}
              title="C66 Android APK Download"
              subtitle="Scan to download package"
              downloadName="c66-scanner-bridge-apk-qr.png"
            />
          </div>

          <div className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-black/60 border border-white/5 font-mono text-[11px] text-neutral-300">
            <span className="truncate max-w-[200px] text-[10px]">{downloadUrl}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition cursor-pointer shrink-0"
              title="Copy APK Download URL"
            >
              {copied ? (
                <IconCheck size={14} className="text-emerald-400" />
              ) : (
                <IconCopy size={14} />
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Actions, Specs & 3-Step Setup (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href="/downloads/c66-scanner-bridge.apk"
              download="c66-scanner-bridge.apk"
              className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white text-xs font-bold font-mono flex items-center justify-center gap-2.5 transition shadow-lg shadow-emerald-900/30"
            >
              <IconDownload size={18} />
              <span>Download C66 Android APK</span>
              <span className="text-[10px] opacity-80 font-normal">(.apk)</span>
            </a>

            <a
              href={apiDownloadUrl}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white text-xs font-mono flex items-center justify-center gap-2 transition"
              title="Download via streaming API"
            >
              <IconExternalLink size={16} />
              <span>Direct Link</span>
            </a>
          </div>

          {/* Feature Highlights Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
            <div className="p-2.5 rounded-lg bg-black/40 border border-emerald-500/20 text-neutral-300 flex items-center gap-2">
              <IconShieldCheck size={16} className="text-emerald-400 shrink-0" />
              <span className="truncate">Pre-configured URL</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-neutral-300 flex items-center gap-2">
              <IconBolt size={16} className="text-amber-400 shrink-0" />
              <span className="truncate">Pistol Trigger (139)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-neutral-300 flex items-center gap-2">
              <IconDeviceMobile size={16} className="text-[#007AFF] shrink-0" />
              <span className="truncate">Glove Screen Overlay</span>
            </div>
          </div>

          {/* 3-Step Setup Instructions */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-white font-bold text-[11px] uppercase tracking-wider">
              <IconCheck size={14} className="text-emerald-400" />
              <span>Quick 3-Step Setup on Chainway C66</span>
            </div>

            <ol className="space-y-2 text-[11px] text-neutral-300">
              <li className="flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 text-[10px] font-bold">
                  1
                </span>
                <div>
                  <strong className="text-white">Download APK:</strong> Scan the QR code above using the C66 camera or open Chrome on the device and navigate to the download link.
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 text-[10px] font-bold">
                  2
                </span>
                <div>
                  <strong className="text-white">Install Package:</strong> Tap the downloaded <code className="text-emerald-300">c66-scanner-bridge.apk</code> notification and tap <strong>&quot;Install&quot;</strong>. (If asked, toggle <em>&quot;Allow installation from unknown sources&quot;</em>).
                </div>
              </li>

              <li className="flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 text-[10px] font-bold">
                  3
                </span>
                <div>
                  <strong className="text-white">Launch &amp; Scan:</strong> Open <strong>Control-Access Bridge</strong>. The app connects automatically to this server. Squeeze the physical pistol grip or tap the on-screen overlay to stream scans straight to your PC!
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
