"use client";

import { useState, useMemo, useRef } from "react";
import Image from "next/image";

export interface DataPoint {
  time: string;
  value: number;
  delta?: string;
}

interface InteractiveStatCardProps {
  id: string;
  title: string;
  value: number;
  label: string;
  iconSrc: string;
  accentColor: string; // hex e.g. "#30D158"
  gradientFrom: string;
  badgeText: string;
  historyData?: Record<"1H" | "8H" | "24H", DataPoint[]>;
}

export default function InteractiveStatCard({
  id,
  title,
  value,
  label,
  iconSrc,
  accentColor,
  gradientFrom,
  badgeText,
  historyData,
}: InteractiveStatCardProps) {
  const [timeRange, setTimeRange] = useState<"1H" | "8H" | "24H">("8H");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Generate fallback series if historyData not provided
  const points: DataPoint[] = useMemo(() => {
    if (historyData && historyData[timeRange]) {
      return historyData[timeRange];
    }
    // Render honest baseline representing current verified value (zero synthetic oscillations)
    const count = timeRange === "1H" ? 8 : timeRange === "8H" ? 12 : 16;
    const pts: DataPoint[] = [];
    for (let i = 0; i < count; i++) {
      const hoursAgo = count - 1 - i;
      const timeStr =
        timeRange === "1H"
          ? `${hoursAgo * 7}m ago`
          : timeRange === "8H"
          ? `${hoursAgo * 40}m ago`
          : `${hoursAgo}h ago`;
      pts.push({
        time: i === count - 1 ? "Now" : timeStr,
        value,
      });
    }
    return pts;
  }, [historyData, timeRange, value]);

  const activePoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;
  const displayValue = activePoint ? activePoint.value : value;
  const displaySubtitle = activePoint
    ? `${activePoint.time}: ${activePoint.value} ${activePoint.delta ? `(${activePoint.delta})` : ""}`
    : label;

  // Compute SVG Bézier curve coordinates
  const svgWidth = 240;
  const svgHeight = 44;
  const paddingX = 4;
  const paddingY = 6;

  const { pathD, areaD, coords } = useMemo(() => {
    if (!points.length) return { pathD: "", areaD: "", coords: [] };
    const minVal = Math.min(...points.map((p) => p.value));
    const maxVal = Math.max(...points.map((p) => p.value));
    const range = maxVal === minVal ? 1 : maxVal - minVal;

    const calculatedCoords = points.map((p, idx) => {
      const x = paddingX + (idx / (points.length - 1)) * (svgWidth - paddingX * 2);
      const y = svgHeight - paddingY - ((p.value - minVal) / range) * (svgHeight - paddingY * 2);
      return { x, y };
    });

    // Build smooth cubic bezier path
    let d = `M ${calculatedCoords[0].x},${calculatedCoords[0].y}`;
    for (let i = 0; i < calculatedCoords.length - 1; i++) {
      const p0 = calculatedCoords[i];
      const p1 = calculatedCoords[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
    }

    const first = calculatedCoords[0];
    const last = calculatedCoords[calculatedCoords.length - 1];
    const aD = `${d} L ${last.x},${svgHeight} L ${first.x},${svgHeight} Z`;

    return { pathD: d, areaD: aD, coords: calculatedCoords };
  }, [points]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !coords.length) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const relX = (clientX / rect.width) * svgWidth;

    let closestIdx = 0;
    let minDiff = Infinity;
    coords.forEach((coord, idx) => {
      const diff = Math.abs(coord.x - relX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    setHoveredIndex(closestIdx);
  };

  const activeCoord = hoveredIndex !== null && coords[hoveredIndex] ? coords[hoveredIndex] : null;

  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    cardRef.current.style.setProperty("--mouse-x", `${x}px`);
    cardRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleCardMouseMove}
      className="group relative h-[190px] w-full overflow-hidden rounded-xl bg-black border border-white/10 p-5 transition-colors hover:border-white/20 flex flex-col justify-between"
    >
      {/* Vercel Spotlight Glow */}
      <div 
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${accentColor}1A, transparent 40%)`
        }}
      />
      
      {/* Top Hairline Sheen with Accent Glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] opacity-80"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        }}
      />

      {/* Header Row: Icon, Title & Time Range Switcher */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Custom Mac-styled Icon Well */}
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] shrink-0 overflow-hidden">
            <Image
              src={iconSrc}
              alt={title}
              width={22}
              height={22}
              className="drop-shadow-[0_0_6px_rgba(0,0,0,0.5)]"
              priority
            />
          </div>
          <div>
            <h3 className="text-[11px] font-mono font-medium uppercase tracking-wider text-neutral-400 leading-tight">
              {title}
            </h3>
            <span
              className="text-[9px] font-mono px-1.5 py-0.2 rounded inline-block mt-0.5"
              style={{
                backgroundColor: `${accentColor}18`,
                color: accentColor,
                border: `1px solid ${accentColor}33`,
              }}
            >
              {badgeText}
            </span>
          </div>
        </div>

        {/* Mini Range Toggle (1H / 8H / 24H) */}
        <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-black/40 p-0.5 text-[9px] font-mono">
          {(["1H", "8H", "24H"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setTimeRange(r);
                setHoveredIndex(null);
              }}
              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                timeRange === r
                  ? "bg-white/15 text-white font-semibold shadow-xs"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Value & Interactive Readout */}
      <div className="mt-2.5 flex items-baseline justify-between">
        <div className="text-2xl font-bold tracking-tight text-white font-sans tabular-nums">
          {displayValue.toLocaleString()}
        </div>
        <div className="text-[10px] font-mono text-neutral-400 truncate max-w-[130px] text-right">
          {displaySubtitle}
        </div>
      </div>

      {/* Interactive Sparkline / Area Graph */}
      <div className="relative mt-2.5 h-[44px] w-full select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-full w-full overflow-visible cursor-crosshair touch-none"
          preserveAspectRatio="none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredIndex(null)}
        >
          <defs>
            <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={gradientFrom} stopOpacity="0.45" />
              <stop offset="100%" stopColor={gradientFrom} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          {areaD && (
            <path
              d={areaD}
              fill={`url(#grad-${id})`}
              className="transition-all duration-300"
            />
          )}

          {/* Stroke Curve */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={accentColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Active Hover Point & Crosshair Guide */}
          {activeCoord && (
            <>
              {/* Vertical Guide Line */}
              <line
                x1={activeCoord.x}
                y1={0}
                x2={activeCoord.x}
                y2={svgHeight}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeDasharray="2 2"
                strokeWidth="1"
              />
              {/* Outer Pulse Glow */}
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="6"
                fill={accentColor}
                opacity="0.3"
                className="animate-ping"
              />
              {/* Solid Point Dot */}
              <circle
                cx={activeCoord.x}
                cy={activeCoord.y}
                r="3.5"
                fill="#ffffff"
                stroke={accentColor}
                strokeWidth="2"
              />
            </>
          )}
        </svg>

        {/* Hover Scrubbing Value Pill (Tooltips near cursor) */}
        {activePoint && activeCoord && (
          <div
            className="pointer-events-none absolute -top-5 z-20 -translate-x-1/2 rounded bg-neutral-900/90 px-1.5 py-0.5 text-[9px] font-mono text-white shadow-md border border-white/20"
            style={{
              left: `${(activeCoord.x / svgWidth) * 100}%`,
            }}
          >
            {activePoint.value}
          </div>
        )}
      </div>
    </div>
  );
}
