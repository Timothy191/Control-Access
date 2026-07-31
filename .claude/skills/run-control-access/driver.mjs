#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.CA_PORT || 8080);
const HOST = process.env.CA_HOST || 'localhost';
const USERNAME = process.env.CA_USER || 'admin';
const PASSWORD = process.env.CA_PASS || 'admin';
const APP_DIR = process.env.CA_APP_DIR || process.cwd();
const SCREENSHOT = process.env.CA_SCREENSHOT || resolve(APP_DIR, 'control-access-dashboard.png');
const LOG_PATH = process.env.CA_LOG || '/tmp/control-access-driver.log';
const TIMEOUT = Number(process.env.CA_TIMEOUT || 30000);

function findPython() {
  const candidates = [
    process.env.CA_PYTHON,
    resolve(APP_DIR, '.venv/bin/python'),
    resolve(APP_DIR, 'venv/bin/python'),
    'python3',
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'python3';
}

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_BIN,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error('Chromium executable not found. Set CHROMIUM_BIN.');
}

async function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.status >= 200 && res.status < 500) return res.status;
    } catch (err) {
      lastErr = err;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`App did not become ready at ${url}: ${lastErr?.message || 'timeout'}`);
}

async function main() {
  const python = findPython();
  const appLog = LOG_PATH;
  console.log(`Starting app from ${APP_DIR} with ${python}`);
  const child = spawn(python, ['app.py'], {
    cwd: APP_DIR,
    env: {
      ...process.env,
      ENABLE_AI_CHAT: 'false',
      OLLAMA_USE_CLOUD: process.env.OLLAMA_USE_CLOUD || 'false',
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logChunks = [];
  child.stdout.on('data', d => logChunks.push(d));
  child.stderr.on('data', d => logChunks.push(d));

  const cleanup = async (signal = 'SIGTERM') => {
    if (child.killed) return;
    child.kill(signal);
    await new Promise(r => setTimeout(r, 1500));
    if (!child.killed) child.kill('SIGKILL');
  };

  const shutdown = () => {
    cleanup().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    const baseUrl = `http://${HOST}:${PORT}`;
    await waitForHttp(`${baseUrl}/login`, TIMEOUT);
    console.log(`App ready at ${baseUrl}`);

    const chromium = findChromium();
    const browser = await puppeteer.launch({
      executablePath: chromium,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    console.log(`Logging in as ${USERNAME}...`);
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 20000 });
    await page.type('#username', USERNAME);
    await page.type('#password', PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }),
      page.click('#loginBtn'),
    ]);

    const url = page.url();
    const title = await page.title();
    if (!url.includes('/dashboard')) {
      throw new Error(`Login failed: ended at ${url} (${title})`);
    }
    console.log(`Login succeeded: ${title} at ${url}`);

    await page.waitForSelector('.dashboard', { timeout: 10000 });
    const screenshotPath = resolve(APP_DIR, SCREENSHOT);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved: ${screenshotPath}`);

    await browser.close();
  } catch (err) {
    console.error('Driver failed:', err.message);
    await writeLog(appLog, logChunks);
    await cleanup();
    process.exit(1);
  }

  await writeLog(appLog, logChunks);
  await cleanup();
}

async function writeLog(path, chunks) {
  try {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path, Buffer.concat(chunks));
  } catch {}
}

main().catch(async err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
