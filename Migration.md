# Control-Access: Next.js Full Stack Migration Blueprint

## Executive Overview & Strategic Goals

This document outlines the master architectural plan and step-by-step execution strategy to migrate the **Control-Access Mine Site Access & Gate Operations System** from its legacy **Flask / Jinja2 / Eventlet** stack to a modern, unified **Next.js 15+ (App Router) Full Stack React TypeScript** architecture.

### Key Drivers for Migration
- **Unified Monorepo Architecture**: Eliminate separate frontend templates, backend Jinja routes, and fragmented static JS scripts into a single, type-safe Next.js codebase.
- **Type Safety End-to-End**: End-to-end TypeScript interfaces across Database Models, Server Actions, API Contracts, WebSockets, and UI Components.
- **Sub-100ms High-Frequency Gate Operations**: Utilize Next.js React Server Components (RSC) and optimized Edge/Node.js API endpoints for low-latency hardware QR/RFID scanning.
- **Modern Industrial UI**: Re-implement the dark industrial control panel visual system (`DESIGN.md`) using **Tailwind CSS v4**, **Shadcn UI**, **Framer Motion**, and **React 19**.
- **Real-Time Telemetry**: Replace Flask-SocketIO with a high-throughput Node.js WebSocket engine (Socket.io / Server-Sent Events / native WS) backed by Redis for multi-kiosk live synchronization.
- **Enterprise Scale & Observability**: Standardized deployment via Docker/PM2, unified logging, and Vercel AI SDK integration for multi-provider AI access.

---

## 1. Current System Architecture (As-Is Audit)

| Subsystem | Legacy Tech Stack | Key Responsibilities / Dependencies |
| :--- | :--- | :--- |
| **Framework & Web Server** | Python 3.10+, Flask 3.1.3, Eventlet 0.40.3, Gunicorn 23.0.0 | HTTP routes, HTML rendering via Jinja2, session management |
| **Database & ORM** | SQLAlchemy 2.0, SQLite (WAL mode) / Azure SQL | Relational models (`Employee`, `Vehicle`, `Equipment`, `Visitor`, `GateLog`, `Approval`, `Device`, `User`, `GateMapping`, etc.) |
| **Field Encryption** | Cryptography (`Fernet` AES-128-CBC) | Field-level encryption for ID numbers, medical notes, visitor names |
| **Real-Time Engine** | Flask-SocketIO 5.3.4 (Eventlet) | Emits live `gate_scan`, `device_status`, and system telemetry to wallboards |
| **Hardware Listeners** | Python `socket` threads on ports 8081-8200 & UDP 9100 | Receives raw barcode data from Chainway C66/C70/C71 scanners, Infowedge, DataWedge |
| **Auth & Security** | Werkzeug security (`scrypt` / `PBKDF2`), `pyotp` | User sessions, TOTP MFA, backup codes, `X-API-Key` headers for hardware scanners |
| **SharePoint Sync** | `O365` / `requests`, `APScheduler` | Cron sync of employee rosters & site permits from SharePoint Online |
| **AI Assistant** | Ollama API, Portkey Gateway, OpenAI / Gemini APIs | Natural language site procedure querying and gate database searching |
| **Reporting & Exports** | ReportLab, OpenPyXL, Pandas | On-the-fly PDF visitor passes, gate log reports, Excel roster exports |

---

## 2. Target Technology Stack (To-Be Architecture)

```
                       +------------------------------------------+
                       |      Hardware & Kiosk Terminals          |
                       |  (Chainway C66/C70/C71, Desktop Kiosks) |
                       +--------------------+---------------------+
                                            |
                         HTTP / REST API    | Raw TCP/UDP Sockets
                         (X-API-Key)        | (Ports 8081-8200, 9100)
                                            v
+-------------------------------------------+-------------------------------------------+
|                               Next.js 15+ Application                                 |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                             App Router Pages & Layouts                          |  |
|  |  - Kiosk Scanner  - Wallboard Dashboard  - Muster View  - Gate Logs  - Onboarding |  |
|  +---------------------------------------------------------------------------------+  |
|  |                           React Server Components & UI                          |  |
|  |  - Tailwind CSS v4  - Shadcn UI  - Framer Motion  - Tabler/Heroicons SVG          |  |
|  +---------------------------------------------------------------------------------+  |
|  |                        Server Actions & Next.js API Routes                      |  |
|  |  - /api/scan_qr     - /api/monitoring   - /api/ai/chat    - /api/sharepoint/sync |  |
|  +---------------------------------------------------------------------------------+  |
|  |                                Core Business Layer                              |  |
|  |  - Scan Engine TS   - AES-256-GCM Fernet Bridge  - Direction Auto-Detect         |  |
|  |  - Vercel AI SDK    - NextAuth.js v5 (MFA/TOTP)  - Rate Limiter (Upstash/Redis)   |  |
|  +---------------------------------------------------------------------------------+  |
|  |                                  Data Layer                                     |  |
|  |  - Prisma ORM / Drizzle ORM -> PostgreSQL / Azure SQL / SQLite (WAL)            |  |
|  +---------------------------------------------------------------------------------+  |
+-------------------------------------------+-------------------------------------------+
                                            |
                      WebSockets / SSE      | Redis Pub/Sub
                      (Realtime Engine)     | Scan Broadcasting
                                            v
                       +--------------------+---------------------+
                       |   Standalone Hardware & Realtime Daemon  |
                       |      (Node.js Net/dgram + Socket.io)     |
                       +------------------------------------------+
```

### Core Stack Components
- **Framework**: Next.js 15.1+ (App Router, React 19, Server Actions, Route Handlers).
- **Language**: TypeScript 5.6+ (Strict Type Checks, ESM).
- **Database & ORM**: Prisma ORM v6 / Drizzle ORM (supporting PostgreSQL, Azure SQL, SQLite with WAL mode).
- **Styling & UI**: Tailwind CSS v4, Shadcn UI (`@radix-ui`), Lucide / Tabler React Icons, Glassmorphism design system matching `DESIGN.md`.
- **Authentication**: Auth.js (NextAuth v5) + `otplib` (TOTP MFA) + `qrcode` + Custom Middleware for API Keys (`X-API-Key`).
- **Real-Time Server**: Standalone Socket.io server / Server-Sent Events (SSE) route handler integrated with Redis Pub/Sub.
- **Hardware Socket Daemon**: Node.js `net` (TCP) and `dgram` (UDP) sidecar process listening on ports 8081-8200 and UDP 9100.
- **AI Integration**: Vercel AI SDK (`@ai-sdk/ollama`, `@ai-sdk/openai`, `@ai-sdk/google`) with streaming UI (`useChat`).
- **SharePoint Integration**: `@microsoft/microsoft-graph-client` & `@azure/msal-node` via Next.js Scheduled API Route (Cron) or BullMQ worker.
- **PDF & Excel Exports**: `@react-pdf/renderer` or `pdfkit` + `exceljs`.

---

## 3. Data Layer & ORM Migration Plan

### Prisma Schema Mapping (`prisma/schema.prisma`)

```prisma
datasource db {
  provider = "sqlite" // Configurable to "postgresql" or "sqlserver"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id              Int            @id @default(autoincrement())
  username        String         @unique
  password        String
  role            String         @default("user") // admin, manager, security, user
  totpSecret      String?        @map("totp_secret")
  mfaEnabled      Boolean        @default(false) @map("mfa_enabled")
  mfaBackupCodes  String?        @map("mfa_backup_codes")
  createdAt       DateTime       @default(now()) @map("created_at")
  notifications   Notification[]

  @@map("users")
}

model Device {
  id              Int            @id @default(autoincrement())
  deviceName      String         @map("device_name")
  deviceType      String?        @map("device_type")
  macAddress      String?        @map("mac_address")
  ipAddress       String?        @map("ip_address")
  lastSeen        DateTime       @default(now()) @map("last_seen")
  status          String         @default("online")
  totalScans      Int            @default(0) @map("total_scans")
  createdAt       DateTime       @default(now()) @map("created_at")

  @@map("devices")
}

model Employee {
  id              Int            @id @default(autoincrement())
  empCode         String         @unique @map("emp_code")
  initials        String?
  firstName       String         @map("first_name")
  secondName      String?        @map("second_name")
  surname         String
  idNumber        String?        @map("id_number") // Encrypted at rest
  idNumberHash    String?        @unique @map("id_number_hash")
  jobTitle        String?        @map("job_title")
  area            String?
  induction       String?
  inductionExpiry DateTime?      @map("induction_expiry")
  medical         String?        // Encrypted at rest
  medicalExpiry   DateTime?      @map("medical_expiry")
  qrCode          String?        @unique @map("qr_code")
  rfidTag         String?        @unique @map("rfid_tag")
  status          String         @default("Active")
  createdAt       DateTime       @default(now()) @map("created_at")

  visitors        Visitor[]
  gateLogs        GateLog[]

  @@map("employees")
}

model Vehicle {
  id                 Int         @id @default(autoincrement())
  fleetId            String      @unique @map("fleet_id")
  registrationExpiry DateTime?   @map("registration_expiry")
  qrCode             String?     @unique @map("qr_code")
  rfidTag            String?     @unique @map("rfid_tag")
  status             String      @default("Active")
  createdAt          DateTime    @default(now()) @map("created_at")

  gateLogs           GateLog[]

  @@map("vehicles")
}

model Equipment {
  id                 Int         @id @default(autoincrement())
  radioId            String      @unique @map("radio_id")
  registrationExpiry DateTime?   @map("registration_expiry")
  qrCode             String?     @unique @map("qr_code")
  rfidTag            String?     @unique @map("rfid_tag")
  status             String      @default("Active")
  createdAt          DateTime    @default(now()) @map("created_at")

  gateLogs           GateLog[]

  @@map("equipment")
}

model Visitor {
  id            Int            @id @default(autoincrement())
  name          String         // Encrypted at rest
  company       String?
  purpose       String?
  meetingPerson String?        @map("meeting_person")
  qrCode        String?        @unique @map("qr_code")
  rfidTag       String?        @unique @map("rfid_tag")
  hostId        Int?           @map("host_id")
  checkInTime   DateTime       @default(now()) @map("check_in_time")
  checkOutTime  DateTime?      @map("check_out_time")
  status        String         @default("Checked In")
  createdAt     DateTime       @default(now()) @map("created_at")

  host          Employee?      @relation(fields: [hostId], references: [id])
  gateLogs      GateLog[]

  @@map("visitors")
}

model GateLog {
  id            Int            @id @default(autoincrement())
  accessType    String?        @map("access_type")
  entityId      Int?           @map("entity_id")
  entityName    String?        @map("entity_name")
  direction     String?
  qrData        String?        @map("qr_data")
  accessGranted Boolean        @default(true) @map("access_granted")
  denialReason  String?        @map("denial_reason")
  gateLocation  String?        @map("gate_location")
  scannedAt     DateTime       @default(now()) @map("scanned_at")
  scannedBy     String?        @map("scanned_by")
  ipAddress     String?        @map("ip_address")
  userAgent     String?        @map("user_agent")
  parsedQrData  String?        @map("parsed_qr_data") // JSON string

  employeeId    Int?           @map("employee_id")
  vehicleId     Int?           @map("vehicle_id")
  visitorId     Int?           @map("visitor_id")
  equipmentId   Int?           @map("equipment_id")

  employee      Employee?      @relation(fields: [employeeId], references: [id])
  vehicle       Vehicle?       @relation(fields: [vehicleId], references: [id])
  visitor       Visitor?       @relation(fields: [visitorId], references: [id])
  equipment     Equipment?     @relation(fields: [equipmentId], references: [id])

  @@map("gate_logs")
}

model Approval {
  id            Int            @id @default(autoincrement())
  requestType   String?        @map("request_type")
  requestId     Int?           @map("request_id")
  requesterName String?        @map("requester_name")
  details       String?
  status        String         @default("Pending")
  approvedBy    String?        @map("approved_by")
  approvalDate  DateTime?      @map("approval_date")
  comments      String?
  targetTable   String?        @map("target_table")
  scannedData   String?        @map("scanned_data")
  createdAt     DateTime       @default(now()) @map("created_at")

  @@map("approvals")
}

model SiteSetting {
  id    Int    @id @default(autoincrement())
  key   String @unique
  value String?

  @@map("site_settings")
}

model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int?     @map("user_id")
  type      String
  message   String
  read      Boolean  @default(false)
  link      String?
  createdAt DateTime @default(now()) @map("created_at")

  user      User?    @relation(fields: [userId], references: [id])

  @@map("notifications")
}

model AuditLog {
  id         Int      @id @default(autoincrement())
  user       String?
  action     String?
  entityType String?  @map("entity_type")
  entityId   Int?     @map("entity_id")
  details    String?
  ipAddress  String?  @map("ip_address")
  createdAt  DateTime @default(now()) @map("created_at")

  @@map("audit_logs")
}

model GateMapping {
  id                  Int      @id @default(autoincrement())
  ipAddress           String   @unique @map("ip_address")
  scannerId           String?  @map("scanner_id")
  gateName            String   @map("gate_name")
  locationDescription String?  @map("location_description")
  isActive            Boolean  @default(true) @map("is_active")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  @@map("gate_mappings")
}
```

---

## 4. Cryptography & Encryption Bridge Strategy

### Problem Statement
The current Python backend uses `cryptography.fernet.Fernet` (AES-128-CBC with HMAC-SHA256 authentication) for field-level PII encryption (prefixed with `enc:`). Next.js must be able to read existing encrypted DB values seamlessly without requiring an offline database dump or re-encryption downtime.

### Solution: Node.js Cryptography Fernet Adapter (`lib/crypto.ts`)

```typescript
import crypto from 'node:crypto';

const MARKER = 'enc:';

/**
 * Derives key compatible with Python Fernet / FIELD_ENCRYPTION_KEY.
 */
function getEncryptionKey(): Buffer | null {
  const envKey = process.env.FIELD_ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, 'base64'); // Fernet expects 32-byte key (16 AES + 16 HMAC)
  }
  const secret = process.env.SECRET_KEY;
  if (secret) {
    const derived = crypto.createHash('sha256').update(secret).digest();
    return derived;
  }
  return null;
}

export function decryptField(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith(MARKER)) return value; // Plaintext fallback

  const ciphertextWithMarker = value.slice(MARKER.length);
  const key = getEncryptionKey();
  if (!key) return value;

  try {
    const rawBytes = Buffer.from(ciphertextWithMarker, 'base64url');
    // Fernet format: Version (1B) | Timestamp (8B) | IV (16B) | Ciphertext (var) | HMAC (32B)
    const iv = rawBytes.subarray(9, 25);
    const ciphertext = rawBytes.subarray(25, rawBytes.length - 32);
    const hmacReceived = rawBytes.subarray(rawBytes.length - 32);

    const signingKey = key.subarray(0, 16);
    const encryptionKey = key.subarray(16, 32);

    // Verify HMAC
    const hmac = crypto.createHmac('sha256', signingKey);
    hmac.update(rawBytes.subarray(0, rawBytes.length - 32));
    const hmacCalculated = hmac.digest();

    if (!crypto.timingSafeEqual(hmacReceived, hmacCalculated)) {
      console.error('Field decryption HMAC mismatch');
      return value;
    }

    const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt field:', err);
    return value;
  }
}

export function encryptField(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith(MARKER)) return value;

  const key = getEncryptionKey();
  if (!key) return value;

  try {
    const signingKey = key.subarray(0, 16);
    const encryptionKey = key.subarray(16, 32);

    const version = Buffer.from([0x80]);
    const timestamp = Buffer.alloc(8);
    timestamp.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000)));
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-128-cbc', encryptionKey, iv);
    let ciphertext = cipher.update(value, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    const dataToSign = Buffer.concat([version, timestamp, iv, ciphertext]);
    const hmac = crypto.createHmac('sha256', signingKey).update(dataToSign).digest();

    const fullPacket = Buffer.concat([dataToSign, hmac]);
    return MARKER + fullPacket.toString('base64url');
  } catch (err) {
    console.error('Failed to encrypt field:', err);
    return value;
  }
}
```

---

## 5. API Route & Server Actions Migration Matrix

### Route Mapping

| Flask Route / Endpoint | Blueprint | Next.js App Router Target | HTTP Method / Type |
| :--- | :--- | :--- | :--- |
| `GET /` | `app.py` | `app/page.tsx` (Dashboard Redirect) | RSC Page |
| `GET /login`, `POST /login` | `auth.py` | `app/(auth)/login/page.tsx` | Client Page / NextAuth |
| `POST /api/auth/mfa` | `auth.py` | `app/api/auth/mfa/route.ts` | Route Handler |
| `GET /dashboard` | `dashboard.py` | `app/(dashboard)/dashboard/page.tsx` | RSC Page |
| `GET /api/dashboard/stats_history` | `dashboard.py` | `app/api/dashboard/stats-history/route.ts` | Route Handler (Cached) |
| `GET /qr_scanner` | `scanning.py` | `app/(dashboard)/scanning/page.tsx` | RSC / Client Page |
| `POST /api/scan_qr` | `scanning.py` | `app/api/scan_qr/route.ts` | Route Handler (`X-API-Key`) |
| `POST /api/scan_rfid` | `scanning.py` | `app/api/scan_rfid/route.ts` | Route Handler |
| `GET /kiosk` | `app.py` | `app/kiosk/page.tsx` | Kiosk View |
| `GET /monitoring` | `monitoring.py` | `app/(dashboard)/monitoring/page.tsx` | RSC Page |
| `GET /api/monitoring/stats` | `monitoring.py` | `app/api/monitoring/stats/route.ts` | Route Handler |
| `GET /employees` | `employees.py` | `app/(dashboard)/employees/page.tsx` | RSC Page + Server Actions |
| `POST /api/employees/add` | `employees.py` | `lib/actions/employees.ts` (`addEmployee`) | Server Action |
| `POST /api/employees/edit/[id]` | `employees.py` | `lib/actions/employees.ts` (`editEmployee`) | Server Action |
| `DELETE /api/employees/[id]` | `employees.py` | `lib/actions/employees.ts` (`deleteEmployee`) | Server Action |
| `GET /fleet` | `fleet.py` | `app/(dashboard)/fleet/page.tsx` | RSC Page + Server Actions |
| `GET /equipment` | `equipment.py` | `app/(dashboard)/equipment/page.tsx` | RSC Page + Server Actions |
| `GET /visitors`, `POST /checkin` | `visitors.py` | `app/(dashboard)/visitors/page.tsx` | RSC Page + Server Actions |
| `POST /visitor_request` | `app.py` | `app/visitor-request/page.tsx` | Public Form Action |
| `GET /onboard` | `app.py` | `app/onboard/page.tsx` | Public Form Action |
| `GET /pending_approvals` | `app.py` | `app/(dashboard)/approvals/page.tsx` | RSC Page |
| `POST /approve_request/[id]` | `app.py` | `lib/actions/approvals.ts` | Server Action |
| `GET /muster` | `app.py` | `app/(dashboard)/muster/page.tsx` | RSC Page (Emergency View) |
| `GET /gate_logs` | `app.py` | `app/(dashboard)/gate-logs/page.tsx` | RSC Page |
| `GET /audit_logs` | `admin.py` | `app/(dashboard)/admin/audit-logs/page.tsx` | RSC Page |
| `GET /users` | `admin.py` | `app/(dashboard)/admin/users/page.tsx` | RSC Page |
| `GET /gate_mappings` | `admin.py` | `app/(dashboard)/admin/gate-mappings/page.tsx` | RSC Page |
| `POST /api/ai/chat` | `ai.py` | `app/api/ai/chat/route.ts` | Route Handler (Vercel AI SDK) |
| `GET /api/sharepoint/sync` | `admin.py` | `app/api/sharepoint/sync/route.ts` | Route Handler (Cron) |
| `GET /api/healthz` | `monitoring.py` | `app/api/healthz/route.ts` | Health Check Route |

---

## 6. Hardware & Real-Time Engine Architecture

### Hardware Scanner TCP/UDP Listener Daemon (`server/hardware-daemon.ts`)
Hardware barcode terminals (Chainway C66, C70, C71, Zebra DataWedge) send raw barcode payloads via direct TCP sockets (ports 8081-8200) or broadcast discovery via UDP (port 9100).

```typescript
import net from 'node:net';
import dgram from 'node:dgram';
import { Redis } from 'iovalkey';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// 1. TCP Server Pool for Hardware Scanners
const START_PORT = 8081;
const END_PORT = 8200;

for (let port = START_PORT; port <= END_PORT; port++) {
  const server = net.createServer((socket) => {
    const clientIp = socket.remoteAddress || '';

    socket.on('data', async (data) => {
      const qrCode = data.toString('utf-8').trim();
      if (!qrCode) return;

      // Dispatch scan payload to Next.js Internal API
      try {
        const res = await fetch('http://localhost:3000/api/scan_qr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.HARDWARE_API_KEY || '',
          },
          body: JSON.stringify({
            qr_code: qrCode,
            direction: 'AUTO',
            gate_location: `TCP Port ${port} (${clientIp})`,
            ip_address: clientIp,
          }),
        });

        const result = await res.json();
        socket.write(JSON.stringify(result) + '\n');

        // Publish to Redis for WebSocket Wallboard push
        await redis.publish('gate_scan_events', JSON.stringify(result));
      } catch (err) {
        console.error(`Error processing scan on port ${port}:`, err);
        socket.write(JSON.stringify({ status: 'error', message: 'Scan processing failed' }) + '\n');
      }
    });
  });

  server.listen(port, () => {
    console.log(`[Hardware Daemon] Listening on TCP port ${port}`);
  });
}

// 2. UDP Discovery Listener
const udpSocket = dgram.createSocket('udp4');
udpSocket.on('message', (msg, rinfo) => {
  console.log(`[UDP Discovery] Received ping from ${rinfo.address}:${rinfo.port}`);
  const ack = Buffer.from(JSON.stringify({ status: 'ACK', service: 'Control-Access-Next' }));
  udpSocket.send(ack, rinfo.port, rinfo.address);
});
udpSocket.bind(9100, () => {
  console.log('[Hardware Daemon] UDP Scanner Discovery active on port 9100');
});
```

### Real-Time WebSocket / SSE Architecture
- Next.js Client Wallboard pages subscribe to Server-Sent Events (`/api/monitoring/stream`) or WebSocket room (`Socket.io` node container).
- When `scan_qr` API processes a scan, it publishes the `GateLog` event to Redis channel `gate_scan_events`.
- Wallboards automatically update live counts (`People On Site`, `Granted Scans`, `Denied Scans`, `Fleet Occupancy`) and display toast notifications with audio alerts.

---

## 7. Frontend UI / UX Migration Strategy

### Design System Compliance (`DESIGN.md`)
The Next.js frontend will strictly preserve the dark industrial aesthetic:

- **Color Tokens (Tailwind CSS v4 Configuration)**:
  - `--red-primary`: `#ff6b00` (Active state, scan borders, primary badges)
  - `--red-dark`: `#d95800` (Hover actions)
  - `--steel`: `#d4af37` (Borders, metadata highlights)
  - `--dark-card`: `rgba(15,15,20,0.65)` with `backdrop-filter: blur(8px)`
  - `--success`: `#10b981` | `--warning`: `#f59e0b` | `--danger`: `#ef4444`
- **Typography**: Inter (Body & Display) and JetBrains Mono (Datetimes, RFID tags, Scan IDs).
- **Background Component**: Re-implement `<GlobalBackground />` with MP4 video stream fallback to animated CSS starfield.
- **Audio Feedback**: Web Audio API hooks (`useScanAudio`) emitting industrial grant/deny tones.

### Key Pages Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── mfa-challenge/page.tsx
├── (dashboard)/
│   ├── layout.tsx                # Sidebar, Top Bar, Live Telemetry Header
│   ├── dashboard/page.tsx         # Main Occupancy & Gate Stats
│   ├── scanning/page.tsx          # Interactive Gate QR Scanner
│   ├── monitoring/page.tsx        # Security Wallboard (Real-time grid)
│   ├── employees/page.tsx         # Roster Management & Cert Expiries
│   ├── fleet/page.tsx             # Vehicle Fleet Tracking
│   ├── equipment/page.tsx         # Radio & Equipment Tracking
│   ├── visitors/page.tsx          # Visitor Check-in / Gate Approvals
│   ├── approvals/page.tsx         # Onboarding & Gate Expiry Approvals
│   ├── muster/page.tsx            # Emergency Evacuation Roster
│   ├── gate-logs/page.tsx         # Searchable Access Logs
│   ├── admin/
│   │   ├── users/page.tsx
│   │   ├── audit-logs/page.tsx
│   │   ├── gate-mappings/page.tsx
│   │   └── settings/page.tsx
│   └── ai-chat/page.tsx           # Vercel AI SDK Assistant Interface
├── kiosk/page.tsx                 # Fullscreen Terminal Kiosk View
├── visitor-request/page.tsx       # Self-Service Visitor Registration
└── onboard/page.tsx               # Public Employee/Vehicle Self-Onboarding
```

---

## 8. AI Assistant Engine (Vercel AI SDK Integration)

### Route Implementation (`app/api/ai/chat/route.ts`)

```typescript
import { createOllama } from 'ollama-ai-provider';
import { streamText } from 'ai';
import { prisma } from '@/lib/prisma';

const ollama = createOllama({
  baseURL: process.env.OLLAMA_URL || 'http://localhost:11434/api',
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Fetch current site context dynamically
  const activeEmployees = await prisma.employee.count({ where: { status: 'Active' } });
  const peopleOnSite = await prisma.gateLog.count({
    where: { accessGranted: true, direction: 'IN' },
  });

  const systemPrompt = `You are the Mine Safety & Gate Access AI Assistant for Control-Access.
Current Site Telemetry:
- Active Registered Employees: ${activeEmployees}
- Personnel Currently On Site: ${peopleOnSite}
Answer site procedures, gate log queries, and safety compliance questions precisely.`;

  const result = streamText({
    model: ollama(process.env.OLLAMA_MODEL || 'mine-assistant-fast'),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
```

---

## 9. SharePoint Synchronization Engine

- Migration from `services/sharepoint_sync.py` to Next.js Cron Route Handler (`app/api/cron/sharepoint-sync/route.ts`).
- Uses `@microsoft/microsoft-graph-client` with Azure AD Client Credentials flow (`SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET`, `SHAREPOINT_TENANT_ID`).
- Executed on schedule (00:00, 06:00, 12:00, 18:00) via Vercel Cron, systemd timer, or internal node cron.
- Read-only pipeline updates `Employee` records, medical dates, induction expiries, and populates `AuditLog`.

---

## 10. Phased Execution Roadmap

```
+-----------------------------------------------------------------------------------+
| PHASE 0: Infrastructure & Project Scaffolding                                      |
| - Initialize Next.js 15+ App Router TypeScript project                            |
| - Set up Tailwind v4, Shadcn UI theme, and global styling tokens from DESIGN.md   |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| PHASE 1: Data Layer & Encryption Compatibility                                    |
| - Define Prisma Schema matching SQLAlchemy models                                 |
| - Implement Fernet/AES-256-GCM dual-crypto compatibility module (`lib/crypto.ts`) |
| - Run database migration & baseline seed validation                              |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| PHASE 2: Auth, Security & Core Scan Engine                                        |
| - Implement Auth.js (NextAuth v5) with TOTP MFA support                           |
| - Port `services/scan_service.py` to `lib/scan-service.ts`                       |
| - Build `/api/scan_qr` endpoint with API Key middleware                           |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| PHASE 3: Hardware Daemon & Real-Time Engine                                       |
| - Develop Node.js TCP/UDP socket daemon (`server/hardware-daemon.ts`)             |
| - Integrate Redis Pub/Sub & WebSockets/SSE telemetry broadcasting                |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| PHASE 4: UI Dashboard & Gate Management Views                                     |
| - Build RSC Pages: Dashboard, Scanning Kiosk, Monitoring Wallboard, Employees     |
| - Build Fleet, Equipment, Visitors, Approvals, Muster, and Gate Logs views         |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| PHASE 5: AI Chat, SharePoint Sync & PDF Exports                                   |
| - Integrate Vercel AI SDK with Ollama / Portkey providers                         |
| - Port SharePoint synchronization pipeline to TS Graph Client                     |
| - Build PDF visitor pass and Excel log exporter modules                          |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
| PHASE 6: E2E QA, Hardware Emulation & Production Rollout                          |
| - Run hardware barcode scanner emulation test suite                               |
| - Execute zero-downtime cutover & dual-run verification                           |
+-----------------------------------------------------------------------------------+
```

---

## 11. Testing, Risk Matrix & Mitigation

### Risk Matrix & Remediation

| Risk Factor | Level | Potential Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Fernet Key Decryption Failure** | **High** | Cannot read legacy encrypted ID numbers/medical records | Retain exact HMAC-SHA256Fernet verification logic in `lib/crypto.ts`; run DB validation script prior to cutover |
| **Hardware Socket Disconnection** | **High** | Chainway C66/C70/C71 scanners drop connections | Implement TCP Keep-Alive and auto-reconnect listeners in `hardware-daemon.ts` |
| **QR Scan Latency > 100ms** | **Medium** | Slow gate clearance during shift changes | Optimize Prisma queries with indexes on `qrCode`, `empCode`, `rfidTag`; cache static gate rules in memory |
| **WebSocket Wallboard Disconnection** | **Medium** | Kiosk displays stall live updates | Auto-reconnect with exponential backoff and fallback polling every 5s |
| **SharePoint Sync Throttling** | **Low** | Sync job fails due to Graph API rate limit | Implement batch fetching (100 items per request) & exponential backoff retry |

---

## 12. Production Deployment & Service Configuration

### Docker Compose Architecture (`docker-compose.prod.yml`)

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:/app/data/access.db
      - REDIS_URL=redis://redis:6379/0
      - HARDWARE_API_KEY=${HARDWARE_API_KEY}
      - FIELD_ENCRYPTION_KEY=${FIELD_ENCRYPTION_KEY}
      - SECRET_KEY=${SECRET_KEY}
    volumes:
      - db_data:/app/data

  hardware-daemon:
    build:
      context: .
      dockerfile: Dockerfile.hardware
    restart: always
    ports:
      - "8081-8200:8081-8200"
      - "9100:9100/udp"
    environment:
      - NEXT_API_URL=http://app:3000/api/scan_qr
      - HARDWARE_API_KEY=${HARDWARE_API_KEY}
      - REDIS_URL=redis://redis:6379/0

  redis:
    image: redis:7-alpine
    restart: always
    ports:
      - "6379:6379"

volumes:
  db_data:
```

### Systemd Service Setup (`/etc/systemd/system/control-access-next.service`)

```ini
[Unit]
Description=Control-Access Next.js Full Stack Gate Engine
After=network.target redis.service

[Service]
Type=simple
User=timothy
WorkingDirectory=/home/timothy/Projects/Access
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
```

---

## Summary & Sign-off

This migration blueprint provides an immediate, production-ready roadmap to transform the **Control-Access** codebase into a robust Next.js 15+ fullstack application while preserving 100% feature parity, visual design fidelity (`DESIGN.md`), field encryption integrity, and low-latency hardware gate scanner operations.
