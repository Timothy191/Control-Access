# Control-Access: Next.js Full Stack Migration Blueprint & Master Execution Plan

> **Target Stack**: Next.js 15+ (App Router, React 19, TypeScript strict), Prisma ORM v6, Tailwind CSS v4 / Shadcn UI (with industrial theme tokens), Auth.js (NextAuth v5), Redis / SSE Real-time Engine, Node.js Hardware Daemon.  
> **Source Stack**: Python 3.10+, Flask 3.1.3, Eventlet 0.40.3, SQLAlchemy 2.0, SQLite (WAL mode) / Azure SQL.  
> **Status**: Comprehensive Architectural Blueprint & Production Migration Specification.

---

## Executive Overview & Strategic Goals

This document outlines the master architectural plan and step-by-step execution strategy to migrate the **Control-Access Mine Site Access & Gate Operations System** from its legacy **Flask / Jinja2 / Eventlet** stack to a modern, unified **Next.js 15+ Full Stack React TypeScript** architecture.

### Key Drivers for Migration
- **Unified Monorepo Architecture**: Eliminate fragmented Jinja templates, separate backend routes, and ad-hoc client scripts into a single, type-safe Next.js codebase.
- **Strict End-to-End Type Safety**: TypeScript interfaces shared across Database Models, Server Actions, API Contracts, WebSockets/SSE, and UI Components.
- **Sub-100ms High-Frequency Gate Operations**: Leverage Next.js Server Components, optimized Route Handlers, and targeted database indices for low-latency QR/RFID scanning.
- **Modern Industrial UI**: Re-implement the dark industrial control panel visual system (`DESIGN.md`) using **Tailwind CSS v4**, **Shadcn UI**, **Framer Motion**, and **React 19** with custom tokens preserving the steel/orange palette.
- **Real-Time Telemetry**: Replace Flask-SocketIO with a high-throughput Node.js WebSocket/SSE engine backed by Redis Pub/Sub for multi-kiosk live synchronization.
- **Hardware Continuity**: Maintain reliable TCP/UDP network socket listeners for Chainway (C66/C70/C71) handhelds and stationary gate scanners.

---

## 1. Codebase Audit & Architectural Delta Analysis

A comprehensive audit of the active codebase (`models.py`, `services/scan_service.py`, `services/listeners.py`, `routes/*`, `DESIGN.md`, `.env.example`) identified critical nuances that must be addressed during migration:

| Subsystem / Area | Current Python Implementation | Target Next.js Architecture | Critical Nuance / Grounded Fix |
| :--- | :--- | :--- | :--- |
| **Framework** | Flask 3.1.3, Jinja2, Eventlet 0.40.3 | Next.js 15.1+ (App Router, React 19, Server Actions) | Standalone Node.js deployment with internal Route Handlers and Server Actions. |
| **Database & ORM** | SQLAlchemy 2.0, SQLite (WAL) / Azure SQL | Prisma ORM v6 (SQLite / PostgreSQL / SQL Server) | Add explicit indices on `qrCode`, `rfidTag`, `empCode`, `idNumberHash` for sub-100ms scan lookups. |
| **Field-Level Encryption** | Cryptography `Fernet` (AES-128-CBC + HMAC-SHA256) | Node.js `crypto` Fernet Compatibility Bridge (`lib/crypto.ts`) | **Fix**: Replicate exact key derivation: base64url decode raw 32-byte key; bytes 0-16 for HMAC, bytes 16-32 for AES-128. |
| **User Authentication** | Werkzeug (`scrypt`/`pbkdf2`), `pyotp` | Auth.js (NextAuth v5) + `otplib` | Password hashes must be parsed according to Werkzeug's `method$salt$hash` scheme or migrated seamlessly. |
| **API Authentication** | `HARDWARE_API_KEY`, `MOBILE_API_KEY` | Custom Next.js Route Middleware | Validate `X-API-Key` headers for both hardware scanners and mobile applications. |
| **Hardware Listeners** | `services/listeners.py` (UDP 5000, 8080, 9000, 9999, 10000; TCP 8081-8200) | Standalone Daemon (`server/hardware-daemon.ts`) | Port conflict resolution: TCP listeners renumbered away from 3000/8080; broadcast on UDP 9999 maintained. |
| **Scan Service Core** | `services/scan_service.py` (1,171 lines) | `src/lib/scan-service.ts` | Complete 1:1 port of QR normalization, multi-stage fallback lookup, expiry checks, and approval validation. |
| **Real-Time Engine** | Flask-SocketIO (Eventlet) | Server-Sent Events (SSE) / Redis Pub/Sub | High-efficiency one-directional SSE stream for wallboards with automated reconnection. |
| **AI Assistant** | `routes/ai.py` (Multi-provider) | Vercel AI SDK (`@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/ollama`, Portkey) | Cascade: Portkey Gateway → Gemini 2.5 Flash → OpenAI → Ollama fallback. |
| **Design System** | `DESIGN.md` (Custom CSS variables) | Tailwind CSS v4 + Shadcn UI Overrides | Map tokens (`--red-primary`, `--steel`, `--dark-card`) directly into `@theme` variables. |

---

## 2. Target Technology Stack & Topology

```
                       +------------------------------------------+
                       |      Hardware & Kiosk Terminals          |
                       |  (Chainway C66/C70/C71, Desktop Kiosks) |
                       +--------------------+---------------------+
                                            |
                          HTTP / REST API    | Raw TCP / UDP Sockets
                          (X-API-Key)        | (Ports 8081-8200, UDP 5000-10000)
                                            v
+-------------------------------------------+-------------------------------------------+
|                               Next.js 15+ Application                                 |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                             App Router Pages & Layouts                          |  |
|  |  - Kiosk Scanner  - Wallboard Dashboard  - Muster View  - Gate Logs  - Onboarding |  |
|  |  - Employee CRUD  - Fleet & Equipment    - Device Status - Admin Audit & Users     |  |
|  +---------------------------------------------------------------------------------+  |
|  |                           React Server Components & UI                          |  |
|  |  - Tailwind CSS v4  - Shadcn UI (Industrial Theme)  - Framer Motion                |  |
|  |  - Video Background (<GlobalBackground />)          - Web Audio Tone Feedback      |  |
|  +---------------------------------------------------------------------------------+  |
|  |                        Server Actions & Next.js API Routes                      |  |
|  |  - /api/scan_qr     - /api/scan_rfid    - /api/monitoring/stream (SSE)            |  |
|  |  - /api/ai/chat     - /api/cron/sharepoint-sync  - /api/exports/*                  |  |
|  +---------------------------------------------------------------------------------+  |
|  |                                Core Business Layer                              |  |
|  |  - Scan Service TS  - Cryptography Fernet Bridge     - Direction Auto-Detect       |  |
|  |  - Vercel AI SDK    - Auth.js v5 (TOTP MFA / Backup) - Rate Limiter (Redis)        |  |
|  +---------------------------------------------------------------------------------+  |
|  |                                  Data Layer                                     |  |
|  |  - Prisma ORM v6 -> SQLite (WAL mode) / PostgreSQL / Azure SQL                     |  |
|  +---------------------------------------------------------------------------------+  |
+-------------------------------------------+-------------------------------------------+
                                            |
                       Redis Pub/Sub        | HTTP Forwarding
                       (Telemetry Channel)  | (Internal API)
                                            v
                       +--------------------+---------------------+
                       |   Standalone Hardware & Realtime Daemon  |
                       |        (Node.js Net/dgram Sidecar)       |
                       +------------------------------------------+
```

---

## 3. Data Layer & Prisma ORM Specification

### `prisma/schema.prisma`

```prisma
datasource db {
  provider = "sqlite" // Easily switchable to "postgresql" or "sqlserver"
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

  @@index([ipAddress])
  @@map("devices")
}

model Employee {
  id              Int            @id @default(autoincrement())
  empCode         String         @unique @map("emp_code")
  initials        String?
  firstName       String         @map("first_name")
  secondName      String?        @map("second_name")
  surname         String
  idNumber        String?        @map("id_number") // Fernet Encrypted
  idNumberHash    String?        @unique @map("id_number_hash")
  jobTitle        String?        @map("job_title")
  area            String?
  induction       String?
  inductionExpiry DateTime?      @map("induction_expiry")
  medical         String?        @map("medical")   // Fernet Encrypted
  medicalExpiry   DateTime?      @map("medical_expiry")
  qrCode          String?        @unique @map("qr_code")
  rfidTag         String?        @unique @map("rfid_tag")
  status          String         @default("Active")
  createdAt       DateTime       @default(now()) @map("created_at")

  visitors        Visitor[]
  gateLogs        GateLog[]

  @@index([empCode])
  @@index([qrCode])
  @@index([rfidTag])
  @@index([idNumberHash])
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

  @@index([fleetId])
  @@index([qrCode])
  @@index([rfidTag])
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

  @@index([radioId])
  @@index([qrCode])
  @@index([rfidTag])
  @@map("equipment")
}

model Visitor {
  id            Int            @id @default(autoincrement())
  name          String         // Fernet Encrypted
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

  @@index([qrCode])
  @@index([rfidTag])
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
  parsedQrData  String?        @map("parsed_qr_data")

  employeeId    Int?           @map("employee_id")
  vehicleId     Int?           @map("vehicle_id")
  visitorId     Int?           @map("visitor_id")
  equipmentId   Int?           @map("equipment_id")

  employee      Employee?      @relation(fields: [employeeId], references: [id])
  vehicle       Vehicle?       @relation(fields: [vehicleId], references: [id])
  visitor       Visitor?       @relation(fields: [visitorId], references: [id])
  equipment     Equipment?     @relation(fields: [equipmentId], references: [id])

  @@index([scannedAt])
  @@index([accessGranted])
  @@index([direction])
  @@index([accessType, entityId])
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

  @@index([status])
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

  @@index([createdAt])
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

## 4. Cryptographic Fernet Bridge (`src/lib/crypto.ts`)

To ensure seamless compatibility with existing SQLite records, the Node.js crypto module must decode Fernet tokens exactly as Python's `cryptography.fernet` does.

```typescript
import crypto from 'node:crypto';

const MARKER = 'enc:';

interface FernetKeys {
  signingKey: Buffer;    // First 16 bytes: HMAC-SHA256
  encryptionKey: Buffer; // Last 16 bytes: AES-128-CBC
}

function getFernetKeys(): FernetKeys | null {
  let rawKey: Buffer | null = null;

  const envKey = process.env.FIELD_ENCRYPTION_KEY;
  if (envKey) {
    // Standard 32-byte Fernet key encoded in URL-safe base64
    rawKey = Buffer.from(envKey, 'base64url');
  } else {
    const secret = process.env.SECRET_KEY;
    if (secret) {
      // Deterministic fallback matching models.py: sha256(secret)
      rawKey = crypto.createHash('sha256').update(secret, 'utf8').digest();
    }
  }

  if (!rawKey || rawKey.length < 32) return null;

  return {
    signingKey: rawKey.subarray(0, 16),
    encryptionKey: rawKey.subarray(16, 32),
  };
}

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(MARKER)) return value; // Plaintext fallback

  const keys = getFernetKeys();
  if (!keys) return value;

  const ciphertextBase64 = value.slice(MARKER.length);

  try {
    const payload = Buffer.from(ciphertextBase64, 'base64url');
    // Fernet Token: Version(1) || Timestamp(8) || IV(16) || Ciphertext(N) || HMAC(32)
    if (payload.length < 57) return value;

    const dataToSign = payload.subarray(0, payload.length - 32);
    const receivedHmac = payload.subarray(payload.length - 32);

    const calculatedHmac = crypto
      .createHmac('sha256', keys.signingKey)
      .update(dataToSign)
      .digest();

    if (!crypto.timingSafeEqual(receivedHmac, calculatedHmac)) {
      console.error('[Crypto] HMAC verification failed for encrypted field');
      return value;
    }

    const iv = payload.subarray(9, 25);
    const ciphertext = payload.subarray(25, payload.length - 32);

    const decipher = crypto.createDecipheriv('aes-128-cbc', keys.encryptionKey, iv);
    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[Crypto] Failed to decrypt field:', error);
    return value;
  }
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith(MARKER)) return value; // Prevent double-encryption

  const keys = getFernetKeys();
  if (!keys) return value;

  try {
    const version = Buffer.from([0x80]);
    const timestamp = Buffer.alloc(8);
    timestamp.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000)));
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-128-cbc', keys.encryptionKey, iv);
    let ciphertext = cipher.update(value, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    const dataToSign = Buffer.concat([version, timestamp, iv, ciphertext]);
    const hmac = crypto
      .createHmac('sha256', keys.signingKey)
      .update(dataToSign)
      .digest();

    const token = Buffer.concat([dataToSign, hmac]);
    return MARKER + token.toString('base64url');
  } catch (error) {
    console.error('[Crypto] Failed to encrypt field:', error);
    return value;
  }
}
```

---

## 5. Comprehensive Route & Server Action Mapping

| Flask Route / Endpoint | Flask Module | Next.js App Router Target | Execution Type | Key Logic / Middlewares |
| :--- | :--- | :--- | :--- | :--- |
| `GET /` | `app.py` | `src/app/page.tsx` | RSC Page | Redirect to `/dashboard` |
| `GET /login`, `POST /login` | `routes/auth.py` | `src/app/(auth)/login/page.tsx` | Client + NextAuth | Credentials verify (Werkzeug format) |
| `POST /api/auth/mfa` | `routes/auth.py` | `src/app/api/auth/mfa/route.ts` | Route Handler | TOTP verification via `otplib` |
| `GET /dashboard` | `routes/dashboard.py` | `src/app/(dashboard)/dashboard/page.tsx` | RSC Page | Occupancy counts, active fleet, stats |
| `GET /api/dashboard/stats_history` | `routes/dashboard.py` | `src/app/api/dashboard/stats-history/route.ts` | Route Handler | 24-hour scan trend cache |
| `GET /qr_scanner` | `routes/scanning.py` | `src/app/(dashboard)/scanning/page.tsx` | RSC + Client Component | HTML5 camera / hardware barcode reader |
| `POST /api/scan_qr` | `routes/scanning.py` | `src/app/api/scan_qr/route.ts` | Route Handler | Validate `HARDWARE_API_KEY` & `MOBILE_API_KEY` |
| `POST /api/scan_rfid` | `routes/scanning.py` | `src/app/api/scan_rfid/route.ts` | Route Handler | RFID resolution to Employee/Vehicle |
| `GET /kiosk` | `app.py` | `src/app/kiosk/page.tsx` | Client Kiosk View | Fullscreen kiosk with audio feedback |
| `GET /monitoring` | `routes/monitoring.py` | `src/app/(dashboard)/monitoring/page.tsx` | RSC Page | Live wallboard layout |
| `GET /api/monitoring/stream` | `routes/monitoring.py` | `src/app/api/monitoring/stream/route.ts` | SSE Route Handler | Streams Redis `gate_scan_events` channel |
| `GET /api/monitoring/stats` | `routes/monitoring.py` | `src/app/api/monitoring/stats/route.ts` | Route Handler | Polling fallback for wallboards |
| `GET /employees` | `routes/employees.py` | `src/app/(dashboard)/employees/page.tsx` | RSC Page | Filterable roster, certification expiries |
| `POST /api/employees/add` | `routes/employees.py` | `src/lib/actions/employees.ts#addEmployee` | Server Action | PII encryption, hash calculation, audit log |
| `POST /api/employees/edit/[id]`| `routes/employees.py` | `src/lib/actions/employees.ts#editEmployee` | Server Action | Partial update, audit log |
| `DELETE /api/employees/[id]` | `routes/employees.py` | `src/lib/actions/employees.ts#deleteEmployee` | Server Action | Soft/hard delete |
| `GET /fleet` | `routes/fleet.py` | `src/app/(dashboard)/fleet/page.tsx` | RSC Page + Server Actions | Fleet registration & tracking |
| `GET /equipment` | `routes/equipment.py` | `src/app/(dashboard)/equipment/page.tsx` | RSC Page + Server Actions | Radio ID & equipment check-out |
| `GET /devices` | `routes/devices.py` | `src/app/(dashboard)/devices/page.tsx` | RSC Page | Hardware terminals list & status |
| `GET /api/devices/status` | `routes/devices.py` | `src/app/api/devices/status/route.ts` | Route Handler | Online/offline telemetry check |
| `GET /visitors` | `routes/visitors.py` | `src/app/(dashboard)/visitors/page.tsx` | RSC Page + Server Actions | Visitor register & check-out |
| `POST /visitor_request` | `app.py` | `src/app/visitor-request/page.tsx` | Public Server Action | Protected by `VISITOR_PIN` |
| `GET /onboard` | `app.py` | `src/app/onboard/page.tsx` | Public Form Action | Self-onboarding request creation |
| `GET /pending_approvals` | `app.py` | `src/app/(dashboard)/approvals/page.tsx` | RSC Page | Review queue for new onboardings |
| `POST /approve_request/[id]` | `app.py` | `src/lib/actions/approvals.ts#approveRequest` | Server Action | Promotes approval into Employee/Fleet table |
| `GET /muster` | `app.py` | `src/app/(dashboard)/muster/page.tsx` | RSC Page | Emergency evacuation roster (On-Site = IN) |
| `GET /gate_logs` | `app.py` | `src/app/(dashboard)/gate-logs/page.tsx` | RSC Page | Paginated access logs with export links |
| `GET /audit_logs` | `routes/admin.py` | `src/app/(dashboard)/admin/audit-logs/page.tsx` | RSC Page | Security log view (Admin only) |
| `GET /users` | `routes/admin.py` | `src/app/(dashboard)/admin/users/page.tsx` | RSC Page | User management & role assignment |
| `GET /gate_mappings` | `routes/admin.py` | `src/app/(dashboard)/admin/gate-mappings/page.tsx` | RSC Page + Server Actions | IP-to-Gate location configuration |
| `POST /api/ai/chat` | `routes/ai.py` | `src/app/api/ai/chat/route.ts` | Route Handler | Multi-provider streaming AI response |
| `GET /api/cron/sharepoint-sync` | `routes/admin.py` | `src/app/api/cron/sharepoint-sync/route.ts` | Cron Route Handler | Microsoft Graph sync pipeline |
| `GET /api/healthz` | `routes/monitoring.py` | `src/app/api/healthz/route.ts` | Route Handler | Healthcheck (DB ping + Redis ping) |
| `GET /api/exports/gate-logs` | `app.py` | `src/app/api/exports/gate-logs/route.ts` | Route Handler | Excel generation via `exceljs` |
| `GET /api/exports/visitor-pass/[id]` | `app.py` | `src/app/api/exports/visitor-pass/[id]/route.ts` | Route Handler | PDF generation via `@react-pdf/renderer` |

---

## 6. Hardware Listener Daemon (`server/hardware-daemon.ts`)

The hardware daemon runs as an isolated sidecar process in Node.js, servicing low-level socket connections from physical scanning hardware.

```typescript
import net from 'node:net';
import dgram from 'node:dgram';
import { Redis } from 'iovalkey';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const NEXT_API_URL = process.env.NEXT_INTERNAL_API_URL || 'http://localhost:3000';
const HARDWARE_API_KEY = process.env.HARDWARE_API_KEY || '';

// 1. TCP Server Pool for Direct Scanner Connections (Ports 8081 - 8200)
const TCP_START_PORT = 8081;
const TCP_END_PORT = 8200;

for (let port = TCP_START_PORT; port <= TCP_END_PORT; port++) {
  const server = net.createServer((socket) => {
    const clientIp = socket.remoteAddress || 'unknown';
    socket.setKeepAlive(true, 5000);

    socket.on('data', async (buffer) => {
      const qrData = buffer.toString('utf8').trim();
      if (!qrData) return;

      try {
        const response = await fetch(`${NEXT_API_URL}/api/scan_qr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': HARDWARE_API_KEY,
          },
          body: JSON.stringify({
            qr_code: qrData,
            direction: 'AUTO',
            gate_location: `TCP Port ${port}`,
            ip_address: clientIp,
          }),
        });

        const result = await response.json();
        socket.write(JSON.stringify(result) + '\n');
      } catch (err) {
        console.error(`[TCP ${port}] Scan dispatch error:`, err);
        socket.write(JSON.stringify({ status: 'error', message: 'Gate API unreachable' }) + '\n');
      }
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Hardware Daemon] TCP listener online on port ${port}`);
  });
}

// 2. Multi-Port UDP Scanning Listeners
const UDP_PORTS = [5000, 8080, 9000, 9999, 10000];

UDP_PORTS.forEach((port) => {
  const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  udpSocket.on('message', async (msg, rinfo) => {
    const qrData = msg.toString('utf8').trim();
    if (!qrData) return;

    try {
      const response = await fetch(`${NEXT_API_URL}/api/scan_qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': HARDWARE_API_KEY,
        },
        body: JSON.stringify({
          qr_code: qrData,
          direction: 'AUTO',
          gate_location: `UDP Port ${port}`,
          ip_address: rinfo.address,
        }),
      });

      const result = await response.json();
      const reply = Buffer.from(JSON.stringify(result));
      udpSocket.send(reply, rinfo.port, rinfo.address);
    } catch (err) {
      console.error(`[UDP ${port}] Scan error from ${rinfo.address}:`, err);
    }
  });

  udpSocket.bind(port, '0.0.0.0', () => {
    console.log(`[Hardware Daemon] UDP listener online on port ${port}`);
  });
});

// 3. UDP Discovery & Broadcast (Port 9100)
const discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
discoverySocket.on('message', (msg, rinfo) => {
  const ack = Buffer.from(JSON.stringify({ status: 'ACK', system: 'Control-Access-Next' }));
  discoverySocket.send(ack, rinfo.port, rinfo.address);
});
discoverySocket.bind(9100, '0.0.0.0', () => {
  console.log('[Hardware Daemon] Discovery listener active on port 9100');
});
```

---

## 7. Real-Time Telemetry & Wallboard Sync

### Server-Sent Events Route (`src/app/api/monitoring/stream/route.ts`)

```typescript
import { NextRequest } from 'next/server';
import { Redis } from 'iovalkey';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: {"status":"ok"}\n\n`));

      await redis.subscribe('gate_scan_events');

      redis.on('message', (channel, message) => {
        if (channel === 'gate_scan_events') {
          controller.enqueue(encoder.encode(`event: scan\ndata: ${message}\n\n`));
        }
      });

      req.signal.addEventListener('abort', () => {
        redis.unsubscribe();
        redis.quit();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
```

---

## 8. Multi-Provider AI Assistant Engine

### `src/app/api/ai/chat/route.ts`

```typescript
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider';
import { prisma } from '@/lib/prisma';

export const maxDuration = 30;

function resolveModel() {
  if (process.env.PORTKEY_API_KEY) {
    const portkey = createOpenAI({
      baseURL: process.env.PORTKEY_BASE_URL || 'https://api.portkey.ai/v1',
      headers: {
        'x-portkey-api-key': process.env.PORTKEY_API_KEY,
        'x-portkey-virtual-key': process.env.PORTKEY_VIRTUAL_KEY || '',
      },
    });
    return portkey(process.env.OPENAI_MODEL || 'gpt-4o-mini');
  }

  if (process.env.GEMINI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
    return google(process.env.GEMINI_MODEL || 'gemini-2.5-flash');
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai(process.env.OPENAI_MODEL || 'gpt-4o-mini');
  }

  const ollama = createOllama({
    baseURL: process.env.OLLAMA_URL || 'http://localhost:11434/api',
  });
  return ollama(process.env.OLLAMA_MODEL || 'mine-assistant-fast');
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  const [activeEmployees, onSiteCount] = await Promise.all([
    prisma.employee.count({ where: { status: 'Active' } }),
    prisma.gateLog.count({ where: { accessGranted: true, direction: 'IN' } }),
  ]);

  const systemPrompt = `You are the Control-Access Mine Site Operational Assistant.
Current Telemetry:
- Active Registered Personnel: ${activeEmployees}
- Personnel Currently On Site (Muster): ${onSiteCount}
Answer questions regarding gate scans, access permissions, and safety inductions accurately and factually.`;

  const result = streamText({
    model: resolveModel(),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
```

---

## 9. Phased Execution Roadmap & Test Gates

```
+-----------------------------------------------------------------------------------+
| PHASE 0: Project Scaffolding & Design System Alignment                            |
| - Initialize Next.js 15+ App Router TypeScript project (pnpm)                     |
| - Configure Tailwind CSS v4 @theme with DESIGN.md color tokens & fonts            |
| - Implement <GlobalBackground /> video fallback & dark glass card components      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 1: Data Layer & Cryptographic Parity                                        |
| - Generate Prisma Schema matching SQLAlchemy schema                               |
| - Implement lib/crypto.ts Fernet compatibility bridge                             |
| - GATE: Execute crypto unit test comparing Python ciphertext output               |
| - Baseline seed verification: 100% successful decryption of existing test data    |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 2: Auth, Security & API Key Validation                                      |
| - Configure Auth.js (NextAuth v5) credentials provider                            |
| - Support Werkzeug hash format verification and TOTP MFA (otplib)                 |
| - Implement API Key middleware for HARDWARE_API_KEY & MOBILE_API_KEY              |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 3: Core Scan Engine TS Port                                                 |
| - Port scan_service.py to src/lib/scan-service.ts                                 |
| - Implement /api/scan_qr and /api/scan_rfid route handlers                        |
| - Direction auto-detection & induction/medical expiry validation                  |
| - GATE: Run test suite across 10+ standard and malformed QR formats               |
| - Benchmark: p99 latency < 100ms on SQLite index lookups                          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 4: Hardware Socket Daemon & Telemetry Streaming                             |
| - Build server/hardware-daemon.ts (TCP pool 8081-8200, UDP 5000-10000)            |
| - Wire Redis Pub/Sub telemetry channel and SSE stream route handler               |
| - Auto-register new hardware devices upon scan event                              |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 5: UI Views & Operational Dashboards                                        |
| - Build RSC Pages: Dashboard, Scanning Kiosk, Monitoring Wallboard, Employees     |
| - Build Fleet, Equipment, Devices, Visitors, Approvals, Muster, and Gate Logs     |
| - Build Public Kiosk, Visitor Self-Service Request, and Onboarding Forms          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 6: AI Assistant, SharePoint Sync & Exporters                                |
| - Deploy multi-provider Vercel AI SDK chat route handler                         |
| - Port SharePoint synchronization pipeline via MS Graph API                       |
| - Implement Excel gate log export (exceljs) and PDF pass generator                |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| PHASE 7: Staging QA, Shadow Mode & Zero-Downtime Cutover                          |
| - Dual-run in Read-Only Shadow Mode alongside legacy Flask server                 |
| - Hardware emulation test via netcat/UDP packet injector                          |
| - Validate backup codes and MFA recovery paths                                    |
| - Execute production cutover by redirecting gateway/reverse-proxy traffic         |
+-----------------------------------------------------------------------------------+
```

---

## 10. Production Deployment & Containerization

### `docker-compose.prod.yml`

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
      - MOBILE_API_KEY=${MOBILE_API_KEY}
      - FIELD_ENCRYPTION_KEY=${FIELD_ENCRYPTION_KEY}
      - SECRET_KEY=${SECRET_KEY}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
    volumes:
      - db_data:/app/data
      - ./assets:/app/public/assets:ro
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/healthz"]
      interval: 15s
      timeout: 5s
      retries: 3
    networks:
      - internal_net
      - public_net

  hardware-daemon:
    build:
      context: .
      dockerfile: Dockerfile.hardware
    restart: always
    ports:
      - "8081-8200:8081-8200"
      - "5000:5000/udp"
      - "8080:8080/udp"
      - "9000:9000/udp"
      - "9100:9100/udp"
      - "9999:9999/udp"
      - "10000:10000/udp"
    environment:
      - NEXT_INTERNAL_API_URL=http://app:3000
      - HARDWARE_API_KEY=${HARDWARE_API_KEY}
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - app
      - redis
    networks:
      - internal_net
      - public_net

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - internal_net

volumes:
  db_data:
  redis_data:

networks:
  internal_net:
    internal: true
  public_net:
    driver: bridge
```

---

## 11. Verification & Compliance Matrix

| Phase | Automated Test / Verification Command | Success Criteria |
| :--- | :--- | :--- |
| **Phase 1: Crypto** | `pnpm test crypto.test.ts` | 100% round-trip parity on Python-encrypted strings; HMAC tamper detection active. |
| **Phase 2: Auth** | `pnpm test auth.test.ts` | Werkzeug hashes verify; TOTP tokens validate; API keys gated on protected routes. |
| **Phase 3: Scan Engine** | `pnpm test scan-service.test.ts` | URLs, raw IDs, JSON, and RFID resolve correctly; auto-direction flip works; latency < 100ms. |
| **Phase 4: Hardware** | `echo "EMP:1002" \| nc -u 127.0.0.1 9000` | UDP scan returns JSON ACK; Redis pub/sub emits event; Device status updated. |
| **Phase 5: UI & Kiosk** | `pnpm playwright test` | Wallboard renders live telemetry; Scanning kiosk triggers audio feedback; Forms submit without error. |
| **Phase 6: Services** | `curl -X POST http://localhost:3000/api/ai/chat` | AI returns streamed SSE tokens with live muster site counts. |
| **Phase 7: Cutover** | Dual-run telemetry comparison | 0 dropped scans; zero schema drift; full data consistency between old and new systems. |
