"use client";

import Link from "next/link";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  iconOnly?: boolean;
  withLink?: boolean;
  className?: string;
  subtitle?: string;
}

export default function BrandLogo({
  size = "md",
  iconOnly = false,
  withLink = true,
  className = "",
  subtitle = "AETHEL MINING & INFRASTRUCTURE",
}: BrandLogoProps) {
  const iconDimensions = {
    sm: { w: 26, h: 26 },
    md: { w: 34, h: 34 },
    lg: { w: 46, h: 46 },
    xl: { w: 60, h: 60 },
  }[size];

  const titleSizes = {
    sm: "text-xs font-bold tracking-tight",
    md: "text-sm font-extrabold tracking-tight",
    lg: "text-lg font-extrabold tracking-tight",
    xl: "text-2xl font-black tracking-tight",
  }[size];

  const subSizes = {
    sm: "text-[8px] tracking-widest",
    md: "text-[9px] tracking-widest",
    lg: "text-[10px] tracking-widest",
    xl: "text-xs tracking-widest",
  }[size];

  const logoContent = (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Corporate Hexagonal Shield Crest */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-xl p-1 bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 shadow-[0_4px_16px_rgba(0,102,255,0.15)] group"
        style={{ width: iconDimensions.w, height: iconDimensions.h }}
      >
        {/* Ambient Sapphire Glow */}
        <div className="absolute inset-0 rounded-xl bg-[#0066FF] opacity-15 blur-sm group-hover:opacity-30 transition-opacity" />

        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full relative z-10"
        >
          {/* Outer Hex Shield */}
          <polygon
            points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"
            stroke="url(#shieldBorder)"
            strokeWidth="4"
            fill="url(#shieldBg)"
          />

          {/* Faceted Geometry */}
          <polygon
            points="50,5 90,27.5 50,50"
            fill="url(#topFacetRight)"
            opacity="0.8"
          />
          <polygon
            points="50,5 10,27.5 50,50"
            fill="url(#topFacetLeft)"
            opacity="0.9"
          />
          <polygon
            points="50,50 90,72.5 50,95"
            fill="url(#bottomFacetRight)"
            opacity="0.85"
          />
          <polygon
            points="50,50 10,72.5 50,95"
            fill="url(#bottomFacetLeft)"
            opacity="0.95"
          />

          {/* Core Central Security Keyhole & Radio Wave */}
          <circle cx="50" cy="50" r="14" fill="#090B0E" stroke="#00F2FE" strokeWidth="2.5" />
          <path
            d="M50 42 L50 48 M46 54 L54 54 M50 48 L47 58 L53 58 Z"
            stroke="#00F2FE"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Signal Rings */}
          <path
            d="M32 50 A 18 18 0 0 1 50 32"
            stroke="#0066FF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />
          <path
            d="M68 50 A 18 18 0 0 1 50 68"
            stroke="#00F2FE"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Gradients */}
          <defs>
            <linearGradient id="shieldBorder" x1="0" y1="0" x2="100" y2="100">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#0066FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00F2FE" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="shieldBg" x1="50" y1="5" x2="50" y2="95">
              <stop offset="0%" stopColor="#11141A" />
              <stop offset="100%" stopColor="#07090C" />
            </linearGradient>
            <linearGradient id="topFacetRight" x1="50" y1="5" x2="90" y2="50">
              <stop offset="0%" stopColor="#0066FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#003B99" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="topFacetLeft" x1="50" y1="5" x2="10" y2="50">
              <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="bottomFacetRight" x1="50" y1="50" x2="90" y2="95">
              <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#002266" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="bottomFacetLeft" x1="50" y1="50" x2="10" y2="95">
              <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#001744" stopOpacity="0.7" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {!iconOnly && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className={`text-white font-sans ${titleSizes}`}>
              CONTROL<span className="text-[#007AFF]">-</span>ACCESS
            </span>
            <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 border border-white/10">
              PRO
            </span>
          </div>
          <span className={`text-neutral-400 font-mono font-medium uppercase truncate ${subSizes}`}>
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );

  if (withLink) {
    return (
      <Link href="/" className="inline-block hover:opacity-95 transition-opacity">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}
