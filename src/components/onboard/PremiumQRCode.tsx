"use client";

import React, { useState, useRef } from "react";
import { QRCode } from "react-qrcode-logo";
import { IconDownload, IconMaximize, IconCheck, IconX } from "@tabler/icons-react";

interface PremiumQRCodeProps {
  value: string;
  title?: string;
  subtitle?: string;
  logoUrl?: string;
  downloadName?: string;
  fgColor?: string;
}

export default function PremiumQRCode({
  value,
  title,
  subtitle,
  logoUrl,
  downloadName = "qrcode.png",
  fgColor = "#ffffff", // changed to white for dark mode if we prefer, but actually QR codes usually need to be dark on light or high contrast. Let's make it white on transparent maybe? Wait, white QR on dark background can be scanned by most modern phones, but black QR on white background is safer.
}: PremiumQRCodeProps) {
  // Let's enforce a light background for maximum scannability, but styled nicely.
  const [isExpanded, setIsExpanded] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!qrRef.current) return;
    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) return;
    
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const renderQR = (size: number) => (
    <div className="relative inline-block bg-white p-3 rounded-2xl shadow-xl" ref={qrRef}>
      <QRCode
        value={value}
        size={size}
        qrStyle="dots"
        eyeRadius={[
          { outer: 8, inner: 4 },
          { outer: 8, inner: 4 },
          { outer: 8, inner: 4 },
        ]}
        fgColor="#09090b"
        bgColor="#ffffff"
        logoImage={logoUrl}
        logoWidth={size * 0.25}
        logoPadding={3}
        logoPaddingStyle="circle"
        removeQrCodeBehindLogo={true}
      />
    </div>
  );

  return (
    <>
      <div className="group relative flex flex-col items-center gap-3">
        {/* Container for the QR */}
        <div className="relative">
          {renderQR(180)}
          
          {/* Overlay Actions on Hover */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2">
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-colors"
              title="Expand"
            >
              <IconMaximize size={20} />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-colors"
              title="Download"
            >
              {downloaded ? <IconCheck size={20} className="text-emerald-400" /> : <IconDownload size={20} />}
            </button>
          </div>
        </div>

        {/* Action Buttons Below */}
        <div className="flex gap-2 w-full max-w-[200px]">
          <button
            onClick={handleDownload}
            className="flex-1 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-neutral-300 flex items-center justify-center gap-1.5 transition"
          >
            {downloaded ? <IconCheck size={14} className="text-emerald-400" /> : <IconDownload size={14} />}
            {downloaded ? "Saved!" : "Save"}
          </button>
        </div>
      </div>

      {/* Expanded Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-in fade-in duration-200">
          <div className="bg-[#18181b] border border-white/10 p-6 rounded-3xl shadow-2xl max-w-sm w-full flex flex-col items-center gap-6 relative">
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition"
            >
              <IconX size={20} />
            </button>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-semibold text-white">{title || "QR Code"}</h3>
              {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
            </div>

            {renderQR(280)}

            <button
              onClick={handleDownload}
              className="w-full py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] text-white font-medium flex items-center justify-center gap-2 transition shadow-lg shadow-blue-500/20 active:scale-95"
            >
              {downloaded ? <IconCheck size={18} /> : <IconDownload size={18} />}
              {downloaded ? "Downloaded Successfully" : "Download High-Res PNG"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
