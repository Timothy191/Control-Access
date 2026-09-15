"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  IconWorld,
  IconRadio,
  IconRefresh,
  IconShieldCheck,
  IconShieldX,
  IconBolt,
  IconHandMove,
  IconMaximize,
} from "@tabler/icons-react";

interface ScanLog {
  id: number;
  access_type: string | null;
  entity_name: string | null;
  direction: string | null;
  access_granted: boolean;
  denial_reason: string | null;
  gate_location: string | null;
  scanned_at: string;
}

interface DigitalGlobeTelemetryProps {
  recentScans?: ScanLog[];
  totalScans?: number;
}

interface GlobePin {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  status: "granted" | "denied" | "active";
  lastScanTime?: string;
  lastEntity?: string;
  denialReason?: string;
  scanCount: number;
  pulseRadius: number;
  pulseAlpha: number;
}

const DEFAULT_PINS: GlobePin[] = [
  {
    id: "pin-1",
    name: "Main Ingress Gate 1",
    code: "GATE-01",
    lat: -26.2041,
    lng: 28.0473, // Johannesburg / Gauteng Gold & Coal Basin
    status: "granted",
    lastEntity: "Bob Johnson (EMP003)",
    lastScanTime: "Just now",
    scanCount: 142,
    pulseRadius: 0,
    pulseAlpha: 1,
  },
  {
    id: "pin-2",
    name: "Haul Road Heavy Fleet Gate",
    code: "HAUL-02",
    lat: -25.7479,
    lng: 28.2293, // North Pretoria / Mining Corridor
    status: "granted",
    lastEntity: "CAT 797F Heavy Hauler #04",
    lastScanTime: "2m ago",
    scanCount: 89,
    pulseRadius: 6,
    pulseAlpha: 0.8,
  },
  {
    id: "pin-3",
    name: "Pit South Portal Shaft",
    code: "SHAFT-S",
    lat: -26.15,
    lng: 27.85, // West Rand Underground Portal
    status: "denied",
    lastEntity: "Apex Drilling Contractor",
    denialReason: "Medical Expired",
    lastScanTime: "4m ago",
    scanCount: 64,
    pulseRadius: 12,
    pulseAlpha: 0.6,
  },
  {
    id: "pin-4",
    name: "Heavy Fleet Maintenance Depot",
    code: "FLEET-DEP",
    lat: -26.31,
    lng: 28.18, // East Rand Engineering Bay
    status: "active",
    lastEntity: "Komatsu PC8000 Excavator",
    lastScanTime: "8m ago",
    scanCount: 45,
    pulseRadius: 3,
    pulseAlpha: 0.9,
  },
  {
    id: "pin-5",
    name: "North Explosives Magazine",
    code: "MAG-01",
    lat: -25.9,
    lng: 27.95, // Rustenburg Platinum Belt
    status: "granted",
    lastEntity: "Certified Blaster Alpha",
    lastScanTime: "12m ago",
    scanCount: 31,
    pulseRadius: 9,
    pulseAlpha: 0.7,
  },
  {
    id: "pin-6",
    name: "Cloudflare Edge Gateway",
    code: "JNB-EDGE",
    lat: -26.1367,
    lng: 28.2411, // JNB Cloudflare Edge PoP
    status: "active",
    lastEntity: "Chainway C66 #01",
    lastScanTime: "Live",
    scanCount: 512,
    pulseRadius: 15,
    pulseAlpha: 0.5,
  },
];

// Pre-compute 3D point cloud dots across the globe surface
function generateSpherePoints(count = 280): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  const phiWeight = Math.PI * (3 - Math.sqrt(5)); // Golden ratio angle

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phiWeight * i;

    const lat = Math.asin(y) * (180 / Math.PI);
    const lng = (theta * (180 / Math.PI)) % 360;

    points.push({ lat, lng });
  }
  return points;
}

export default function DigitalGlobeTelemetry({
  recentScans = [],
  totalScans = 0,
}: DigitalGlobeTelemetryProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Rotation and Interaction State
  const rotationYRef = useRef<number>(1.2); // Start rotated to showcase Southern Africa
  const rotationXRef = useRef<number>(-0.32); // ~ -18deg axial tilt
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0.0035, y: 0 });
  const idleTimerRef = useRef<number>(0);

  const [hoveredPin, setHoveredPin] = useState<GlobePin | null>(null);
  const [selectedPin, setSelectedPin] = useState<GlobePin | null>(null);
  const [activePins, setActivePins] = useState<GlobePin[]>(DEFAULT_PINS);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [lastScanAlert, setLastScanAlert] = useState<{
    entity: string;
    gate: string;
    granted: boolean;
  } | null>(null);

  // Sphere dot cloud
  const sphereDots = useMemo(() => generateSpherePoints(260), []);

  // Update pin data dynamically from recentScans prop
  useEffect(() => {
    if (!recentScans || recentScans.length === 0) return;

    const latest = recentScans[0];
    setLastScanAlert({
      entity: latest.entity_name || "Unknown Credential",
      gate: latest.gate_location || "Main Ingress Gate 1",
      granted: latest.access_granted,
    });

    setActivePins((prevPins) => {
      const targetLocation = (latest.gate_location || "").toLowerCase();
      let matched = false;

      const updated = prevPins.map((pin) => {
        const isMatch =
          targetLocation.includes(pin.name.toLowerCase()) ||
          targetLocation.includes(pin.code.toLowerCase()) ||
          (targetLocation.includes("main") && pin.code === "GATE-01") ||
          (targetLocation.includes("haul") && pin.code === "HAUL-02") ||
          (targetLocation.includes("pit") && pin.code === "SHAFT-S");

        if (isMatch && !matched) {
          matched = true;
          return {
            ...pin,
            status: (latest.access_granted ? "granted" : "denied") as "granted" | "denied",
            lastEntity: latest.entity_name || "RFID Tag",
            denialReason: latest.denial_reason || undefined,
            lastScanTime: "Just now",
            scanCount: pin.scanCount + 1,
            pulseRadius: 0,
            pulseAlpha: 1.0,
          };
        }
        return pin;
      });

      // If no pin matched specifically, pulse the primary gate
      if (!matched && updated.length > 0) {
        updated[0] = {
          ...updated[0],
          status: (latest.access_granted ? "granted" : "denied") as "granted" | "denied",
          lastEntity: latest.entity_name || "Gate Access",
          denialReason: latest.denial_reason || undefined,
          lastScanTime: "Just now",
          scanCount: updated[0].scanCount + 1,
          pulseRadius: 0,
          pulseAlpha: 1.0,
        };
      }

      return updated;
    });

    // Auto-clear alert toast after 4s
    const toastTimer = setTimeout(() => setLastScanAlert(null), 4000);
    return () => clearTimeout(toastTimer);
  }, [recentScans]);

  // Main 3D Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Auto-rotation physics
      if (!isDraggingRef.current && isAutoRotating) {
        rotationYRef.current += velocityRef.current.x;
        // Dampen any user flick velocity back to normal
        velocityRef.current.x =
          velocityRef.current.x * 0.96 + 0.0035 * 0.04;
      }

      const cx = width / 2;
      const cy = height / 2 + 6;
      const R = Math.min(width, height) * 0.38; // Radius of 3D globe

      const rotY = rotationYRef.current;
      const rotX = rotationXRef.current;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Helper function: Project 3D spherical coordinates (lat, lng) to 2D screen
      const project3D = (lat: number, lng: number, radius = R) => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);

        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);

        // Rotate around Y-axis
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // Rotate around X-axis
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        // Perspective projection
        const cameraDist = 600;
        const fov = cameraDist / (cameraDist - z2);
        const screenX = cx + x1 * fov;
        const screenY = cy - y2 * fov;

        return { screenX, screenY, z: z2, fov };
      };

      // 1. Draw Atmospheric Glow & Outer Ring
      const bgGrad = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.25);
      bgGrad.addColorStop(0, "rgba(0, 122, 255, 0.06)");
      bgGrad.addColorStop(0.75, "rgba(34, 211, 238, 0.04)");
      bgGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Atmospheric Edge Halo
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 242, 254, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2. Draw Latitude Circles (Parallels)
      const latAngles = [-60, -30, 0, 30, 60];
      latAngles.forEach((lat) => {
        ctx.beginPath();
        let started = false;
        for (let lng = 0; lng <= 360; lng += 8) {
          const p = project3D(lat, lng);
          if (p.z > -R * 0.15) {
            // Semi-visible even when slightly in back for 3D transparency
            if (!started) {
              ctx.moveTo(p.screenX, p.screenY);
              started = true;
            } else {
              ctx.lineTo(p.screenX, p.screenY);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle =
          lat === 0
            ? "rgba(34, 211, 238, 0.28)" // Equator is brighter
            : "rgba(0, 122, 255, 0.12)";
        ctx.lineWidth = lat === 0 ? 1.2 : 0.8;
        ctx.stroke();
      });

      // 3. Draw Longitude Circles (Meridians)
      for (let lng = 0; lng < 360; lng += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; lat += 6) {
          const p = project3D(lat, lng);
          if (p.z > -R * 0.1) {
            if (!started) {
              ctx.moveTo(p.screenX, p.screenY);
              started = true;
            } else {
              ctx.lineTo(p.screenX, p.screenY);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = "rgba(0, 122, 255, 0.1)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // 4. Draw Digital Dot-Matrix (Fibonacci Point Cloud on Sphere)
      sphereDots.forEach((dot) => {
        const p = project3D(dot.lat, dot.lng);
        if (p.z > 0) {
          // Front-facing dot
          const depthRatio = Math.max(0.1, p.z / R);
          const alpha = 0.15 + depthRatio * 0.45;
          const radius = 1.0 + depthRatio * 0.8;

          ctx.beginPath();
          ctx.arc(p.screenX, p.screenY, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 242, 254, ${alpha})`;
          ctx.fill();
        } else {
          // Back-facing ghost dot
          ctx.beginPath();
          ctx.arc(p.screenX, p.screenY, 0.7, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0, 122, 255, 0.04)";
          ctx.fill();
        }
      });

      // 5. Draw Scan Location Pins & Beacons
      activePins.forEach((pin) => {
        const p = project3D(pin.lat, pin.lng);
        const isVisible = p.z > -R * 0.1;

        // Animate shockwave radar ring
        pin.pulseRadius += 0.35;
        pin.pulseAlpha = Math.max(0, 1 - pin.pulseRadius / 24);
        if (pin.pulseRadius > 24) {
          pin.pulseRadius = 0;
          pin.pulseAlpha = 1;
        }

        if (isVisible) {
          const isFront = p.z > 0;
          const alphaScale = isFront ? 1 : 0.25;

          // Pin color based on status
          const colorHex =
            pin.status === "granted"
              ? "#10B981" // Emerald
              : pin.status === "denied"
              ? "#EF4444" // Rose/Red
              : "#00F2FE"; // Cyan

          // Shockwave Expanding Ring
          if (isFront && pin.pulseAlpha > 0.05) {
            ctx.beginPath();
            ctx.arc(p.screenX, p.screenY, pin.pulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle =
              pin.status === "granted"
                ? `rgba(16, 185, 129, ${pin.pulseAlpha * 0.7})`
                : pin.status === "denied"
                ? `rgba(239, 68, 68, ${pin.pulseAlpha * 0.8})`
                : `rgba(0, 242, 254, ${pin.pulseAlpha * 0.6})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          // Vertical Antenna Beam extending outward
          const beamHeight = 18 * p.fov;
          const tipX = p.screenX;
          const tipY = p.screenY - beamHeight;

          if (isFront) {
            // Glow gradient on antenna pole
            const beamGrad = ctx.createLinearGradient(p.screenX, p.screenY, tipX, tipY);
            beamGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
            beamGrad.addColorStop(1, colorHex);
            ctx.beginPath();
            ctx.moveTo(p.screenX, p.screenY);
            ctx.lineTo(tipX, tipY);
            ctx.strokeStyle = beamGrad;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Beacon Head Glow
            ctx.beginPath();
            ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = colorHex;
            ctx.shadowColor = colorHex;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0; // reset

            // Center white core
            ctx.beginPath();
            ctx.arc(tipX, tipY, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();

            // Base Anchor
            ctx.beginPath();
            ctx.arc(p.screenX, p.screenY, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
            ctx.fill();

            // Location Code Badge (Pill label)
            ctx.font = "bold 9px monospace";
            const textMetrics = ctx.measureText(pin.code);
            const pillW = textMetrics.width + 8;
            const pillH = 14;
            const pillX = tipX + 6;
            const pillY = tipY - 7;

            // Background pill
            ctx.fillStyle = "rgba(10, 14, 18, 0.85)";
            ctx.strokeStyle = colorHex;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, 4);
            ctx.fill();
            ctx.stroke();

            // Text label
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(pin.code, pillX + 4, pillY + 10);
          } else {
            // Ghost pin on rear of globe
            ctx.beginPath();
            ctx.arc(p.screenX, p.screenY, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 122, 255, ${alphaScale * 0.4})`;
            ctx.fill();
          }
        }
      });

      // 6. Orbital Equatorial Gyroscope Ring
      ctx.beginPath();
      ctx.ellipse(cx, cy, R * 1.18, R * 0.32, rotX * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 242, 254, 0.09)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      ctx.restore();

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [activePins, isAutoRotating, sphereDots]);

  // Pointer Drag-to-Rotate handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) {
      // Hover detection for interactive pins
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2 + 6;
      const R = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.38;

      const cosY = Math.cos(rotationYRef.current);
      const sinY = Math.sin(rotationYRef.current);
      const cosX = Math.cos(rotationXRef.current);
      const sinX = Math.sin(rotationXRef.current);

      let found: GlobePin | null = null;
      for (const pin of activePins) {
        const phi = (90 - pin.lat) * (Math.PI / 180);
        const theta = (pin.lng + 180) * (Math.PI / 180);

        const x = -R * Math.sin(phi) * Math.cos(theta);
        const y = R * Math.cos(phi);
        const z = R * Math.sin(phi) * Math.sin(theta);

        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        if (z2 > 0) {
          const fov = 600 / (600 - z2);
          const screenX = cx + x1 * fov;
          const tipY = cy - y2 * fov - 18 * fov;

          const dist = Math.hypot(mouseX - screenX, mouseY - tipY);
          if (dist < 18) {
            found = pin;
            break;
          }
        }
      }
      setHoveredPin(found);
      return;
    }

    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;

    rotationYRef.current += deltaX * 0.007;
    rotationXRef.current = Math.max(
      -0.8,
      Math.min(0.8, rotationXRef.current - deltaY * 0.006)
    );

    velocityRef.current = {
      x: deltaX * 0.002,
      y: deltaY * 0.002,
    };

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // If tapped on a hovered pin, select it
    if (hoveredPin) {
      setSelectedPin(hoveredPin);
    }
  };

  const resetGlobeView = useCallback(() => {
    rotationYRef.current = 1.2;
    rotationXRef.current = -0.32;
    velocityRef.current = { x: 0.0035, y: 0 };
    setIsAutoRotating(true);
    setSelectedPin(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="lg:col-span-4 flex flex-col h-full relative overflow-hidden rounded-2xl border border-white/10 hover:border-white/20 bg-[#141418]/85 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.36)] font-mono text-xs transition-all duration-200 group/globe"
    >
      {/* Subtle top accent gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#007AFF]/10 via-transparent to-transparent opacity-0 group-hover/globe:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00F2FE]/50 to-transparent" />

      {/* Header Bar */}
      <div className="p-3.5 sm:p-4 border-b border-white/[0.08] flex items-center justify-between gap-2 bg-black/30 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00F2FE] shadow-[0_0_8px_rgba(0,242,254,0.8)] animate-pulse" />
          <h3 className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
            <IconWorld size={14} className="text-[#00F2FE]" />
            <span>3D Scan Telemetry Globe</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[10px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{activePins.length} Active Nodes</span>
          </span>

          <button
            type="button"
            onClick={() => setIsAutoRotating((prev) => !prev)}
            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
            title={isAutoRotating ? "Pause Auto-Rotation" : "Resume Rotation"}
          >
            <IconRefresh size={13} className={isAutoRotating ? "animate-spin-slow" : ""} />
          </button>
        </div>
      </div>

      {/* Main 3D Canvas Viewport */}
      <div className="relative flex-1 min-h-[290px] w-full flex items-center justify-center select-none overflow-hidden bg-gradient-to-b from-black/20 via-black/40 to-black/60">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full cursor-grab active:cursor-grabbing touch-none block"
        />

        {/* Drag Hint Overlay */}
        <div className="absolute top-2.5 left-3 pointer-events-none flex items-center gap-1.5 text-[9px] font-mono text-neutral-400 bg-black/60 px-2 py-0.5 rounded-full border border-white/5 backdrop-blur-md">
          <IconHandMove size={11} className="text-[#00F2FE]" />
          <span>Drag to inspect 3D nodes</span>
        </div>

        {/* Real-time Scan Flash Pill */}
        {lastScanAlert && (
          <div
            className={`absolute top-2.5 right-3 animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full border backdrop-blur-md shadow-lg ${
              lastScanAlert.granted
                ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/80 border-rose-500/40 text-rose-300"
            }`}
          >
            {lastScanAlert.granted ? (
              <IconShieldCheck size={13} className="text-emerald-400" />
            ) : (
              <IconShieldX size={13} className="text-rose-400" />
            )}
            <span className="font-semibold truncate max-w-[150px]">
              {lastScanAlert.entity}
            </span>
          </div>
        )}

        {/* Floating Tooltip / HUD for Hovered or Selected Pin */}
        {(hoveredPin || selectedPin) && (
          <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-[#090d10]/95 border border-[#00F2FE]/30 shadow-2xl backdrop-blur-xl z-20 animate-in fade-in zoom-in-95 duration-150">
            {(() => {
              const pin = selectedPin || hoveredPin!;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          pin.status === "granted"
                            ? "bg-emerald-400 shadow-[0_0_8px_#10B981]"
                            : pin.status === "denied"
                            ? "bg-rose-400 shadow-[0_0_8px_#EF4444]"
                            : "bg-cyan-400 shadow-[0_0_8px_#00F2FE]"
                        }`}
                      />
                      <span className="font-bold text-xs text-white">
                        {pin.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-[#00F2FE]">
                      {pin.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-300 pt-0.5">
                    <div>
                      <span className="text-neutral-500 block text-[9px]">
                        LATEST CREDENTIAL
                      </span>
                      <span className="text-white font-medium truncate block">
                        {pin.lastEntity || "None"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-neutral-500 block text-[9px]">
                        COORDINATES
                      </span>
                      <span className="text-neutral-300 font-mono text-[9px]">
                        {pin.lat.toFixed(2)}°S, {pin.lng.toFixed(2)}°E
                      </span>
                    </div>
                  </div>

                  {pin.denialReason && (
                    <div className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-bold">
                      Refusal: {pin.denialReason}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Footer Status Bar with Live Ticker */}
      <div className="p-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-[10px] text-neutral-400 z-10 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="truncate">
            Total Telemetry Events:{" "}
            <strong className="text-white font-mono">
              {totalScans || activePins.reduce((acc, p) => acc + p.scanCount, 0)}
            </strong>
          </span>
        </div>

        <button
          type="button"
          onClick={resetGlobeView}
          className="text-[#007AFF] hover:text-[#0A84FF] font-medium transition cursor-pointer shrink-0 ml-2"
        >
          Reset Angle
        </button>
      </div>
    </div>
  );
}
