"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  IconWorld,
  IconRadar,
  IconRefresh,
  IconShieldCheck,
  IconShieldX,
  IconCrosshair,
  IconHandMove,
  IconLayersLinked,
  IconActivity,
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

export interface GlobePin {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  region: string;
  status: "granted" | "denied" | "active";
  lastScanTime?: string;
  lastEntity?: string;
  denialReason?: string;
  scanCount: number;
  pulseRadius: number;
  pulseAlpha: number;
}

// Global Network Nodes (Distributed across continents to guarantee 360-degree visibility)
const GLOBAL_NETWORK_PINS: GlobePin[] = [
  {
    id: "pin-jnb-scada",
    name: "Gauteng SCADA Command",
    code: "JNB-HQ",
    lat: -26.2041,
    lng: 28.0473,
    region: "Southern Africa",
    status: "granted",
    lastEntity: "System Admin (ADM001)",
    lastScanTime: "Just now",
    scanCount: 142,
    pulseRadius: 0,
    pulseAlpha: 1,
  },
  {
    id: "pin-brk-pit",
    name: "Brakfontein Colliery Gateway",
    code: "BRK-GATE",
    lat: -26.12,
    lng: 28.85,
    region: "Mpumalanga Basin",
    status: "granted",
    lastEntity: "Bob Johnson (EMP003)",
    lastScanTime: "1m ago",
    scanCount: 98,
    pulseRadius: 6,
    pulseAlpha: 0.8,
  },
  {
    id: "pin-rust-plat",
    name: "Rustenburg Platinum Shaft",
    code: "RUST-03",
    lat: -25.65,
    lng: 27.24,
    region: "North West Belt",
    status: "denied",
    lastEntity: "Apex Drilling Contractor",
    denialReason: "Medical Expired",
    lastScanTime: "3m ago",
    scanCount: 64,
    pulseRadius: 10,
    pulseAlpha: 0.6,
  },
  {
    id: "pin-cpt-logistics",
    name: "Cape Town Logistics Terminal",
    code: "CPT-LOG",
    lat: -33.9249,
    lng: 18.4241,
    region: "Western Cape Hub",
    status: "active",
    lastEntity: "Freight Convoys #12",
    lastScanTime: "6m ago",
    scanCount: 45,
    pulseRadius: 4,
    pulseAlpha: 0.9,
  },
  {
    id: "pin-edge-jnb",
    name: "Cloudflare Edge Gateway JNB01",
    code: "EDGE-JNB",
    lat: -26.1367,
    lng: 28.2411,
    region: "Cloudflare Edge",
    status: "active",
    lastEntity: "Chainway C66 #01",
    lastScanTime: "Live",
    scanCount: 512,
    pulseRadius: 15,
    pulseAlpha: 0.5,
  },
  {
    id: "pin-lhr-hub",
    name: "Global Cloud Disaster Recovery",
    code: "LHR-SYNC",
    lat: 51.5074,
    lng: -0.1278,
    region: "Europe Hub",
    status: "active",
    lastEntity: "WAL Ledger Replica",
    lastScanTime: "12s ago",
    scanCount: 384,
    pulseRadius: 8,
    pulseAlpha: 0.7,
  },
  {
    id: "pin-usa-sync",
    name: "North America Cloud Backup",
    code: "IAD-DR",
    lat: 38.9072,
    lng: -77.0369,
    region: "US East",
    status: "active",
    lastEntity: "Encrypted DB Sync",
    lastScanTime: "45s ago",
    scanCount: 220,
    pulseRadius: 12,
    pulseAlpha: 0.6,
  },
  {
    id: "pin-apac-perth",
    name: "APAC Mining Heavy Fleet Link",
    code: "PER-FLEET",
    lat: -31.9505,
    lng: 115.8605,
    region: "Western Australia",
    status: "granted",
    lastEntity: "Autonomous Hauler #08",
    lastScanTime: "4m ago",
    scanCount: 76,
    pulseRadius: 5,
    pulseAlpha: 0.8,
  },
  {
    id: "pin-dxb-hub",
    name: "Middle East Industrial Relay",
    code: "DXB-RELAY",
    lat: 25.2048,
    lng: 55.2708,
    region: "Middle East",
    status: "active",
    lastEntity: "Telemetry Broker",
    lastScanTime: "2m ago",
    scanCount: 115,
    pulseRadius: 9,
    pulseAlpha: 0.7,
  },
];

// Tactical Mine Gates (Local Sector Coordinates with Distinct Radar Coordinates)
const TACTICAL_MINE_GATES = [
  {
    id: "gate-main-01",
    name: "Main Ingress Turnstiles",
    code: "GATE-01",
    x: 0,
    y: -55,
    distanceKm: "0.2 km",
    status: "granted",
    lastEntity: "Bob Johnson (EMP003)",
    lastScanTime: "Just now",
    scanCount: 142,
  },
  {
    id: "gate-haul-02",
    name: "Haul Road Heavy Machinery Gate",
    code: "HAUL-02",
    x: 65,
    y: -20,
    distanceKm: "1.4 km",
    status: "granted",
    lastEntity: "CAT 797F Heavy Hauler #04",
    lastScanTime: "2m ago",
    scanCount: 89,
  },
  {
    id: "gate-pit-north",
    name: "North Pit Portal & Incline",
    code: "PIT-N",
    x: -58,
    y: -40,
    distanceKm: "2.1 km",
    status: "active",
    lastEntity: "Shift Alpha Dispatch",
    lastScanTime: "5m ago",
    scanCount: 52,
  },
  {
    id: "gate-shaft-south",
    name: "Pit South Shaft Personnel Cage",
    code: "SHAFT-S",
    x: -45,
    y: 50,
    distanceKm: "3.8 km",
    status: "denied",
    lastEntity: "Apex Drilling Contractor",
    denialReason: "Medical Expired",
    lastScanTime: "3m ago",
    scanCount: 64,
  },
  {
    id: "gate-mag-north",
    name: "North Explosives Magazine",
    code: "MAG-01",
    x: -15,
    y: -85,
    distanceKm: "4.5 km",
    status: "granted",
    lastEntity: "Certified Blaster Alpha",
    lastScanTime: "12m ago",
    scanCount: 31,
  },
  {
    id: "gate-c66-fleet",
    name: "Chainway C66 Handheld Mesh Hub",
    code: "C66-MESH",
    x: 45,
    y: 55,
    distanceKm: "0.8 km",
    status: "active",
    lastEntity: "Roaming Rover #02",
    lastScanTime: "Live",
    scanCount: 512,
  },
];

// Curated Continent Points: Anchors defining Africa, Europe, Asia, Americas, Australia
const CONTINENT_ANCHORS: Array<[number, number]> = [
  // Southern & Central Africa
  [-34, 18], [-33, 26], [-30, 25], [-29, 31], [-26, 28], [-25, 27], [-24, 30], [-22, 17], [-19, 23], [-15, 28],
  [-12, 40], [-4, 39], [0, 32], [-2, 29], [4, 36], [9, 39], [11, 43], [12, 15], [7, 21], [2, 16],
  // West & North Africa
  [5, 0], [6, -3], [9, -13], [14, -17], [18, -16], [21, -17], [28, -13], [32, -9], [35, -5], [36, 3],
  [37, 10], [33, 11], [32, 20], [31, 30], [27, 34], [22, 37], [25, 17], [20, 0], [16, -5],
  // Madagascar
  [-13, 49], [-18, 47], [-24, 44],
  // Western & Southern Europe
  [36, -5], [37, -8], [43, -9], [43, -3], [44, 0], [48, -4], [50, 1], [49, 6], [46, 2], [43, 6],
  [41, 1], [38, -1], [40, 9], [37, 14], [41, 15], [45, 12], [46, 14], [39, 22], [41, 24], [44, 21],
  // UK, Ireland, Scandinavia
  [51, 0], [53, -2], [56, -4], [58, -5], [52, -8], [54, -7], [56, 10], [59, 11], [60, 15], [63, 15],
  [68, 17], [70, 25], [65, 22], [60, 18], [60, 25], [65, 26], [68, 28],
  // Central & Eastern Europe
  [52, 13], [50, 14], [48, 17], [46, 20], [44, 26], [46, 29], [48, 24], [52, 21], [54, 20], [53, 27],
  [56, 24], [58, 25], [59, 30], [56, 37], [52, 36], [48, 38], [45, 34],
  // Middle East
  [32, 35], [30, 32], [28, 34], [25, 37], [21, 39], [17, 43], [13, 45], [17, 54], [22, 59], [25, 55],
  [29, 48], [30, 47], [33, 44], [36, 42], [37, 36], [39, 33], [40, 43], [36, 50], [32, 53], [28, 56],
  // India & South Asia
  [24, 69], [21, 70], [16, 73], [11, 76], [8, 77], [10, 79], [13, 80], [17, 82], [21, 87], [22, 89],
  [26, 89], [27, 82], [28, 77], [25, 76], [29, 71], [34, 74], [31, 68],
  // East & Southeast Asia
  [22, 91], [16, 96], [12, 99], [6, 100], [1, 104], [3, 101], [7, 100], [10, 105], [16, 108], [21, 106],
  [22, 114], [25, 119], [30, 121], [35, 119], [38, 121], [39, 126], [35, 128], [42, 130], [48, 133],
  [35, 136], [38, 140], [43, 144], [34, 133], [32, 130],
  // Australia & New Zealand
  [-12, 131], [-15, 136], [-18, 141], [-23, 150], [-27, 153], [-32, 152], [-37, 150], [-38, 145],
  [-35, 138], [-33, 135], [-32, 129], [-34, 122], [-35, 117], [-32, 116], [-28, 114], [-22, 114],
  [-17, 122], [-14, 126], [-41, 146], [-37, 175], [-43, 171],
  // North America
  [19, -99], [17, -93], [16, -91], [21, -87], [26, -97], [29, -94], [29, -89], [25, -80], [30, -81],
  [34, -77], [37, -76], [41, -73], [44, -70], [45, -64], [47, -53], [48, -64], [52, -56], [58, -62],
  [62, -70], [58, -78], [52, -81], [51, -89], [46, -84], [43, -83], [42, -88], [47, -91], [49, -95],
  [52, -100], [56, -110], [60, -115], [63, -120], [68, -135], [71, -156], [65, -168], [59, -158],
  [56, -132], [50, -126], [47, -124], [42, -124], [37, -122], [33, -118], [28, -113], [24, -110],
  // South America
  [11, -74], [8, -77], [4, -77], [-1, -80], [-5, -81], [-12, -77], [-18, -71], [-24, -70], [-33, -71],
  [-42, -73], [-52, -75], [-55, -67], [-49, -67], [-42, -63], [-37, -57], [-34, -54], [-30, -50],
  [-23, -43], [-18, -39], [-13, -39], [-8, -35], [-5, -35], [-3, -40], [-1, -48], [4, -51], [6, -58]
];

// Generate dense landmass point cloud
function generateContinentMatrix(): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  for (const [lat, lng] of CONTINENT_ANCHORS) {
    points.push({ lat, lng });
    // Add realistic land dispersion around anchor
    points.push({ lat: lat + 1.6, lng: lng + 1.8 });
    points.push({ lat: lat - 1.6, lng: lng - 1.8 });
    points.push({ lat: lat + 2.4, lng: lng - 1.2 });
  }
  return points;
}

export default function DigitalGlobeTelemetry({
  recentScans = [],
  totalScans = 0,
}: DigitalGlobeTelemetryProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // View Mode: "globe" (Global 3D Orbit) or "radar" (Tactical Mine Sector)
  const [viewMode, setViewMode] = useState<"globe" | "radar">("globe");

  // 3D Rotation State
  const rotationYRef = useRef<number>(1.25); // Initial view tilted towards Southern Africa
  const rotationXRef = useRef<number>(-0.32);
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const velocityRef = useRef<{ x: number; y: number }>({ x: 0.0035, y: 0 });
  const radarAngleRef = useRef<number>(0);

  const [hoveredPin, setHoveredPin] = useState<GlobePin | null>(null);
  const [selectedPin, setSelectedPin] = useState<GlobePin | null>(null);
  const [activePins, setActivePins] = useState<GlobePin[]>(GLOBAL_NETWORK_PINS);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [lastScanAlert, setLastScanAlert] = useState<{
    entity: string;
    gate: string;
    granted: boolean;
  } | null>(null);

  // Continent land dots
  const continentDots = useMemo(() => generateContinentMatrix(), []);

  // Update pin data when live scan arrives
  useEffect(() => {
    if (!recentScans || recentScans.length === 0) return;

    const latest = recentScans[0];
    setLastScanAlert({
      entity: latest.entity_name || "Verified ID",
      gate: latest.gate_location || "Main Ingress Gate 1",
      granted: latest.access_granted,
    });

    setActivePins((prevPins) => {
      const targetLoc = (latest.gate_location || "").toLowerCase();
      let matched = false;

      const updated = prevPins.map((pin) => {
        const isMatch =
          targetLoc.includes(pin.name.toLowerCase()) ||
          targetLoc.includes(pin.code.toLowerCase()) ||
          (targetLoc.includes("brakfontein") && pin.code === "BRK-GATE") ||
          (targetLoc.includes("haul") && pin.code === "BRK-GATE") ||
          (targetLoc.includes("main") && pin.code === "JNB-HQ") ||
          (targetLoc.includes("pit") && pin.code === "RUST-03");

        if (isMatch && !matched) {
          matched = true;
          return {
            ...pin,
            status: (latest.access_granted ? "granted" : "denied") as "granted" | "denied",
            lastEntity: latest.entity_name || "RFID Badge",
            denialReason: latest.denial_reason || undefined,
            lastScanTime: "Just now",
            scanCount: pin.scanCount + 1,
            pulseRadius: 0,
            pulseAlpha: 1.0,
          };
        }
        return pin;
      });

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

    const timer = setTimeout(() => setLastScanAlert(null), 4500);
    return () => clearTimeout(timer);
  }, [recentScans]);

  // Main Canvas Render Loop
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

      const cx = width / 2;
      const cy = height / 2;

      // ==========================================
      // VIEW MODE 1: 3D ROTATING GLOBE (EARTH)
      // ==========================================
      if (viewMode === "globe") {
        if (!isDraggingRef.current && isAutoRotating) {
          rotationYRef.current += velocityRef.current.x;
          velocityRef.current.x = velocityRef.current.x * 0.98 + 0.003 * 0.02;
        }

        const R = Math.min(width, height) * 0.36; // 3D sphere radius
        const rotY = rotationYRef.current;
        const rotX = rotationXRef.current;
        const cosY = Math.cos(rotY);
        const sinY = Math.sin(rotY);
        const cosX = Math.cos(rotX);
        const sinX = Math.sin(rotX);

        // Project lat/lng to screen
        const project3D = (lat: number, lng: number, radius = R) => {
          const phi = (90 - lat) * (Math.PI / 180);
          const theta = (lng + 180) * (Math.PI / 180);

          const x = -radius * Math.sin(phi) * Math.cos(theta);
          const y = radius * Math.cos(phi);
          const z = radius * Math.sin(phi) * Math.sin(theta);

          const x1 = x * cosY - z * sinY;
          const z1 = x * sinY + z * cosY;

          const y2 = y * cosX - z1 * sinX;
          const z2 = y * sinX + z1 * cosX;

          const cameraDist = 550;
          const fov = cameraDist / (cameraDist - z2);
          const screenX = cx + x1 * fov;
          const screenY = cy - y2 * fov;

          return { screenX, screenY, z: z2, fov };
        };

        // 1. Atmospheric Glow
        const bgGrad = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.3);
        bgGrad.addColorStop(0, "rgba(0, 102, 255, 0.08)");
        bgGrad.addColorStop(0.6, "rgba(0, 242, 254, 0.04)");
        bgGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // 2. Globe Sphere Dark Core
        const sphereGrad = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.25, R * 0.1, cx, cy, R);
        sphereGrad.addColorStop(0, "rgba(12, 24, 46, 0.85)");
        sphereGrad.addColorStop(0.75, "rgba(7, 14, 28, 0.95)");
        sphereGrad.addColorStop(1, "rgba(3, 7, 16, 0.98)");
        ctx.fillStyle = sphereGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();

        // 3. Globe Edge Fresnel Rim
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 242, 254, 0.35)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 4. Parallels (Latitude lines)
        const latitudes = [-60, -30, 0, 30, 60];
        latitudes.forEach((lat) => {
          ctx.beginPath();
          let drawing = false;
          for (let lng = 0; lng <= 360; lng += 6) {
            const p = project3D(lat, lng);
            if (p.z > -R * 0.1) {
              if (!drawing) {
                ctx.moveTo(p.screenX, p.screenY);
                drawing = true;
              } else {
                ctx.lineTo(p.screenX, p.screenY);
              }
            } else {
              drawing = false;
            }
          }
          ctx.strokeStyle = lat === 0 ? "rgba(0, 242, 254, 0.25)" : "rgba(30, 80, 160, 0.18)";
          ctx.lineWidth = lat === 0 ? 1.2 : 0.7;
          ctx.stroke();
        });

        // 5. Meridians (Longitude lines)
        for (let lng = 0; lng < 360; lng += 45) {
          ctx.beginPath();
          let drawing = false;
          for (let lat = -80; lat <= 80; lat += 5) {
            const p = project3D(lat, lng);
            if (p.z > -R * 0.1) {
              if (!drawing) {
                ctx.moveTo(p.screenX, p.screenY);
                drawing = true;
              } else {
                ctx.lineTo(p.screenX, p.screenY);
              }
            } else {
              drawing = false;
            }
          }
          ctx.strokeStyle = "rgba(30, 80, 160, 0.16)";
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }

        // 6. Realistic Continent Landmass Dots
        continentDots.forEach((dot) => {
          const p = project3D(dot.lat, dot.lng);
          if (p.z > -R * 0.2) {
            const alpha = Math.max(0.08, (p.z + R * 0.2) / (R * 1.2));
            const isAfrica = dot.lat >= -35 && dot.lat <= 37 && dot.lng >= -18 && dot.lng <= 52;
            
            ctx.fillStyle = isAfrica
              ? `rgba(0, 242, 254, ${alpha * 0.85})`
              : `rgba(16, 185, 129, ${alpha * 0.65})`;

            ctx.beginPath();
            const dotSize = (p.z > 0 ? 1.6 : 1.1) * p.fov;
            ctx.arc(p.screenX, p.screenY, dotSize, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // 7. Render Telemetry Nodes (Elevation Pins + Shockwaves)
        activePins.forEach((pin) => {
          const p = project3D(pin.lat, pin.lng);

          // Update pulse shockwave animation
          pin.pulseRadius += 0.45;
          pin.pulseAlpha = Math.max(0, pin.pulseAlpha - 0.015);
          if (pin.pulseRadius > 28) {
            pin.pulseRadius = 0;
            pin.pulseAlpha = 1.0;
          }

          if (p.z > -R * 0.1) {
            const isFront = p.z > 0;
            const pinColor =
              pin.status === "granted"
                ? "#10B981"
                : pin.status === "denied"
                ? "#EF4444"
                : "#00F2FE";

            // Shockwave Ripple
            if (isFront && pin.pulseAlpha > 0) {
              ctx.beginPath();
              ctx.arc(p.screenX, p.screenY, pin.pulseRadius * p.fov, 0, Math.PI * 2);
              ctx.strokeStyle =
                pin.status === "granted"
                  ? `rgba(16, 185, 129, ${pin.pulseAlpha * 0.7})`
                  : pin.status === "denied"
                  ? `rgba(239, 68, 68, ${pin.pulseAlpha * 0.8})`
                  : `rgba(0, 242, 254, ${pin.pulseAlpha * 0.6})`;
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }

            // Elevation Mast / Leader Line
            const mastHeight = 16 * p.fov;
            const topY = p.screenY - mastHeight;

            ctx.beginPath();
            ctx.moveTo(p.screenX, p.screenY);
            ctx.lineTo(p.screenX, topY);
            ctx.strokeStyle = pinColor;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Mast Beacon Head
            ctx.beginPath();
            ctx.arc(p.screenX, topY, 3.5 * p.fov, 0, Math.PI * 2);
            ctx.fillStyle = pinColor;
            ctx.shadowColor = pinColor;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0; // reset

            // White Inner Core
            ctx.beginPath();
            ctx.arc(p.screenX, topY, 1.5 * p.fov, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            // Label tag (only if on front hemisphere and prominent)
            if (isFront && (selectedPin?.id === pin.id || hoveredPin?.id === pin.id || p.z > R * 0.35)) {
              ctx.font = "bold 9px monospace";
              const tagWidth = ctx.measureText(pin.code).width + 8;
              const tagX = p.screenX + 6;
              const tagY = topY - 5;

              ctx.fillStyle = "rgba(10, 15, 26, 0.9)";
              ctx.strokeStyle = pinColor;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(tagX, tagY - 9, tagWidth, 13, 3);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = "#ffffff";
              ctx.fillText(pin.code, tagX + 4, tagY);
            }
          }
        });
      }

      // ==========================================
      // VIEW MODE 2: TACTICAL MINE SECTOR RADAR
      // ==========================================
      else {
        radarAngleRef.current += 0.025;
        const sweepAngle = radarAngleRef.current;
        const radarRadius = Math.min(width, height) * 0.38;

        // Radar Scope Background
        const radarGrad = ctx.createRadialGradient(cx, cy, radarRadius * 0.1, cx, cy, radarRadius);
        radarGrad.addColorStop(0, "rgba(8, 26, 38, 0.85)");
        radarGrad.addColorStop(1, "rgba(2, 10, 18, 0.95)");
        ctx.fillStyle = radarGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.fill();

        // Range Rings (5km, 15km, 30km, 50km)
        [0.25, 0.5, 0.75, 1.0].forEach((ratio, idx) => {
          ctx.beginPath();
          ctx.arc(cx, cy, radarRadius * ratio, 0, Math.PI * 2);
          ctx.strokeStyle = ratio === 1.0 ? "rgba(0, 242, 254, 0.4)" : "rgba(0, 242, 254, 0.15)";
          ctx.lineWidth = ratio === 1.0 ? 1.5 : 0.8;
          ctx.stroke();

          // Range Label
          ctx.font = "8px monospace";
          ctx.fillStyle = "rgba(0, 242, 254, 0.4)";
          ctx.fillText(`${(idx + 1) * 12}km`, cx + 4, cy - radarRadius * ratio + 10);
        });

        // Azimuth Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx - radarRadius, cy);
        ctx.lineTo(cx + radarRadius, cy);
        ctx.moveTo(cx, cy - radarRadius);
        ctx.lineTo(cx, cy + radarRadius);
        ctx.strokeStyle = "rgba(0, 242, 254, 0.15)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Rotating Radar Sweep Cone
        const sweepGrad = ctx.createConicGradient(sweepAngle, cx, cy);
        sweepGrad.addColorStop(0, "rgba(0, 242, 254, 0.35)");
        sweepGrad.addColorStop(0.12, "rgba(0, 242, 254, 0.0)");
        sweepGrad.addColorStop(1, "rgba(0, 242, 254, 0.0)");
        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.fill();

        // Render Tactical Gates
        TACTICAL_MINE_GATES.forEach((gate) => {
          const gx = cx + (gate.x / 100) * radarRadius;
          const gy = cy + (gate.y / 100) * radarRadius;

          const gateColor =
            gate.status === "granted"
              ? "#10B981"
              : gate.status === "denied"
              ? "#EF4444"
              : "#00F2FE";

          // Target Pulse
          ctx.beginPath();
          ctx.arc(gx, gy, 7, 0, Math.PI * 2);
          ctx.strokeStyle = gateColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(gx, gy, 3, 0, Math.PI * 2);
          ctx.fillStyle = gateColor;
          ctx.fill();

          // Gate Label Card
          ctx.font = "bold 9px monospace";
          const text = `${gate.code} • ${gate.distanceKm}`;
          const textWidth = ctx.measureText(text).width + 8;

          ctx.fillStyle = "rgba(10, 15, 26, 0.85)";
          ctx.strokeStyle = gateColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(gx + 9, gy - 7, textWidth, 14, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, gx + 13, gy + 3);
        });
      }

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [viewMode, activePins, isAutoRotating, continentDots, selectedPin, hoveredPin]);

  // Pointer drag for globe view
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (viewMode !== "globe") return;
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (viewMode !== "globe") return;
    if (!isDraggingRef.current) {
      // Hover detection
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      const R = Math.min(canvas.clientWidth, canvas.clientHeight) * 0.36;

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
          const fov = 550 / (550 - z2);
          const screenX = cx + x1 * fov;
          const tipY = cy - y2 * fov - 16 * fov;

          const dist = Math.hypot(mouseX - screenX, mouseY - tipY);
          if (dist < 20) {
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
      -0.85,
      Math.min(0.85, rotationXRef.current - deltaY * 0.006)
    );

    velocityRef.current = {
      x: deltaX * 0.002,
      y: deltaY * 0.002,
    };

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (viewMode !== "globe") return;
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (hoveredPin) {
      setSelectedPin(hoveredPin);
    }
  };

  const resetGlobeView = useCallback(() => {
    rotationYRef.current = 1.25;
    rotationXRef.current = -0.32;
    velocityRef.current = { x: 0.0035, y: 0 };
    setIsAutoRotating(true);
    setSelectedPin(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-[400px] flex flex-col relative overflow-hidden rounded-2xl border border-white/10 hover:border-white/20 bg-[#141418]/85 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.36)] font-mono text-xs transition-all duration-200 group/globe"
    >
      {/* Top Ambient Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00F2FE]/50 to-transparent" />

      {/* Header Bar */}
      <div className="p-3.5 sm:p-4 border-b border-white/[0.08] flex items-center justify-between gap-2 bg-black/30 shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#00F2FE] shadow-[0_0_8px_rgba(0,242,254,0.8)] animate-pulse" />
          <h3 className="font-semibold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
            {viewMode === "globe" ? <IconWorld size={14} className="text-[#00F2FE]" /> : <IconRadar size={14} className="text-[#00F2FE]" />}
            <span>{viewMode === "globe" ? "3D Telemetry Globe" : "Tactical Mine Sector"}</span>
          </h3>
        </div>

        {/* View Mode Switcher Toggle */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center p-0.5 rounded-lg bg-black/60 border border-white/10 text-[10px]">
            <button
              type="button"
              onClick={() => setViewMode("globe")}
              className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                viewMode === "globe"
                  ? "bg-[#007AFF] text-white font-bold shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconWorld size={11} />
              <span>Orbit</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("radar")}
              className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                viewMode === "radar"
                  ? "bg-[#007AFF] text-white font-bold shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <IconRadar size={11} />
              <span>Sector</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAutoRotating((prev) => !prev)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer border border-white/5"
            title={isAutoRotating ? "Pause Rotation" : "Resume Rotation"}
          >
            <IconRefresh size={13} className={isAutoRotating && viewMode === "globe" ? "animate-spin-slow" : ""} />
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 w-full flex items-center justify-center select-none overflow-hidden bg-gradient-to-b from-black/20 via-black/40 to-black/60">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full cursor-grab active:cursor-grabbing touch-none block"
        />

        {/* Interaction Hint Overlay */}
        <div className="absolute top-2.5 left-3 pointer-events-none flex items-center gap-1.5 text-[9px] font-mono text-neutral-400 bg-black/60 px-2 py-0.5 rounded-full border border-white/5 backdrop-blur-md">
          {viewMode === "globe" ? (
            <>
              <IconHandMove size={11} className="text-[#00F2FE]" />
              <span>Drag to orbit continents</span>
            </>
          ) : (
            <>
              <IconCrosshair size={11} className="text-[#00F2FE]" />
              <span>Real-time perimeter radar</span>
            </>
          )}
        </div>

        {/* Real-time Scan Flash Alert */}
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
            <span className="font-semibold truncate max-w-[140px]">
              {lastScanAlert.entity}
            </span>
          </div>
        )}

        {/* HUD Card for Hovered or Selected Pin */}
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
                      <span className="font-bold text-xs text-white truncate">
                        {pin.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-[#00F2FE]">
                      {pin.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-300 pt-0.5">
                    <div>
                      <span className="text-neutral-500 block text-[9px]">LATEST ACTIVITY</span>
                      <span className="text-white font-medium truncate block">
                        {pin.lastEntity || "Nominal"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-neutral-500 block text-[9px]">REGION / SECTOR</span>
                      <span className="text-neutral-300 font-mono text-[9px] truncate block">
                        {pin.region}
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
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="truncate">
            Telemetry Events: <strong className="text-white font-mono">{totalScans || 14}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={resetGlobeView}
          className="text-[#007AFF] hover:text-[#0A84FF] font-medium transition cursor-pointer shrink-0 ml-2"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
