/**
 * System Health and Connectivity Diagnostics Endpoint
 * File: src/app/api/health/route.ts
 *
 * Verifies database connectivity, Cloudflare Tunnel ingress, and system runtime.
 * Fulfills Dockerfile health checks and automated test suites.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getTunnelStatus } from "@/lib/tunnel";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus = "connected";
  let dbLatencyMs = 0;
  let isDbHealthy = true;

  // 1. Check Database Connectivity (SQLite / Prisma)
  const dbStart = Date.now();
  try {
    // BigInt return from SQLite raw query handled cleanly without JSON serialization issues
    await prisma.$queryRaw`SELECT 1 as ping`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (err) {
    dbStatus = "disconnected";
    isDbHealthy = false;
    console.error("Health check DB error:", err);
  }

  // 2. Check Cloudflare Tunnel State
  let tunnel;
  try {
    tunnel = await getTunnelStatus();
  } catch (err) {
    console.error("Health check tunnel lookup error:", err);
    tunnel = {
      active: false,
      public_url: "unavailable",
      provider: "cloudflare" as const,
      source: "fallback" as const,
      edge_location: "unknown",
      protocol: "QUIC / HTTP/2",
      encryption: "Edge TLS 1.3",
      connector_id: "",
      updated_at: timestamp,
    };
  }

  // 3. Compile System Metrics
  const systemState = {
    status: isDbHealthy ? "ok" : "unhealthy",
    version: "0.1.0",
    service: "control-access",
    timestamp,
    uptime_seconds: Math.floor(process.uptime()),
    database: {
      status: dbStatus,
      latency_ms: dbLatencyMs,
      provider: "sqlite",
    },
    tunnel: {
      status: tunnel.active ? "online" : "degraded",
      public_url: tunnel.public_url,
      provider: tunnel.provider,
      edge_location: tunnel.edge_location,
      protocol: tunnel.protocol,
      rtt_ms: tunnel.metrics?.quicSmoothedRttMs ?? null,
      source: tunnel.source,
    },
    process: {
      node_version: process.version,
      memory_rss_mb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      heap_used_mb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
    },
  };

  return NextResponse.json(systemState, {
    status: isDbHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
