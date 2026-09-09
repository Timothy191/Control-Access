---
name: verify
description: Build, launch, and drive the Control-Access Next.js app for runtime verification. Puppeteer-core + system Chromium; Next dev server on :3002 (often already running via pm2).
---

# Verify Control-Access (Next.js)

Note: `.claude/skills/run-control-access/` targets the OLD Flask app
(`~/Desktop/Control-Access`, `python app.py`, port 8080) — stale since the
Next.js migration. Use this skill instead.

## Launch

A dev server is usually already running (check `pm2 list`, port **3002**).
If not:

```bash
pm2 start "pnpm dev" --name access-verify
pm2 logs access-verify --nostream   # wait for "Ready"; note the port
```

Do NOT start a second `next dev` in the same repo — it detects the running
server and either bounces ports or restart-loops.

Login page does not require auth; other routes redirect to
`/login?callbackUrl=...`. Default creds `admin` / `admin`.

## Drive

puppeteer-core is NOT installed in the project. Install ad-hoc:

```bash
mkdir -p /tmp/verify-puppeteer && cd /tmp/verify-puppeteer
npm init -y && npm install puppeteer-core
```

```js
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu',
         '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://localhost:3002/login',
                { waitUntil: 'networkidle0', timeout: 30000 });
```

## Worth driving

- Login page — background video (`video[source="/background.mp4"]`): check
  `readyState===4`, `paused===false`, `currentTime` advances, resolution.
- Login flow: fill `Username`/`Password`, click `Sign In`, expect redirect.
- Sidebar nav routes: `/`, `/employees`, `/visitors`, `/fleet`, `/equipment`,
  `/approvals`, `/database`, `/admin`, `/onboard` (all glassmorphism pages).
- Server actions (approve/reject) POST with the `Next-Action` header — need a
  session cookie; actions IDs live in `.next/server/server-reference-manifest.json`.

## Gotchas

- DB is SQLite at `mine_management.db` (repo root); Prisma `db push` schema.
- `/api/scan_qr` needs the `X-API-Key` header, not a session.
- Video is served with HTTP 206 range requests — that's correct for `<video>`.