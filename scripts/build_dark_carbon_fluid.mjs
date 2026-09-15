import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const width = 1280;
const height = 720;
const fps = 24;
const durationSeconds = 8;
const totalFrames = fps * durationSeconds; // 192 frames

console.log(`[Fluid Engine] Initializing Dark Carbon Fluid synthesis: ${width}x${height} @ ${fps}fps (${totalFrames} frames)`);

// 1. Backup legacy background video if not already backed up
const legacyPath = "public/background.mp4";
const backupPath = "public/background.legacy-galaxy.mp4";
if (fs.existsSync(legacyPath) && !fs.existsSync(backupPath)) {
  fs.copyFileSync(legacyPath, backupPath);
  console.log(`[Fluid Engine] Backed up original cosmic video to ${backupPath}`);
}

const twoPi = Math.PI * 2;
const lx = 0.5, ly = -0.6, lz = 0.62;
const lenL = Math.sqrt(lx * lx + ly * ly + lz * lz);
const nlx = lx / lenL, nly = ly / lenL, nlz = lz / lenL;
const eps = 0.015;

// Spawn ffmpeg for MP4 generation
const tempRawMp4 = "public/background.mp4";
const ffmpegMp4 = spawn("ffmpeg", [
  "-y",
  "-f", "rawvideo",
  "-pix_fmt", "rgb24",
  "-s", `${width}x${height}`,
  "-r", `${fps}`,
  "-i", "-",
  "-vf", "scale=1920:1080:flags=bicubic",
  "-c:v", "libx264",
  "-profile:v", "high",
  "-level:v", "4.1",
  "-crf", "26",
  "-preset", "medium",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  "-an",
  tempRawMp4
]);

ffmpegMp4.stderr.on("data", () => {}); // swallow verbose logs

const frameBuffer = Buffer.alloc(width * height * 3);

function renderFrame(frameIdx) {
  const phase = frameIdx / totalFrames;
  const sinP = Math.sin(twoPi * phase);
  const cosP = Math.cos(twoPi * phase);

  function fluidNoise(x, y) {
    const qx = Math.sin(x * 0.8 + y * 0.6 + sinP * 0.8);
    const qy = Math.cos(x * 0.5 - y * 0.7 + cosP * 0.8);

    const rx = Math.sin((x + qx * 1.2) * 1.1 + (y + qy * 1.2) * 0.9 + cosP * 0.6);
    const ry = Math.cos((x - qx * 1.1) * 0.9 + (y + qy * 1.0) * 1.2 + sinP * 0.6);

    return Math.sin((x + rx * 1.5) * 0.7 + (y + ry * 1.5) * 0.8 + sinP * 0.5) * 0.6 +
           Math.cos((x * 1.4 - ry * 1.2) * 0.8 + (y * 1.2 + rx * 1.1) * 0.7 - cosP * 0.5) * 0.4;
  }

  for (let y = 0; y < height; y++) {
    const v = (y / height) * 2 - 1;
    const vy = v * 2.2;
    const v2 = v * v;
    for (let x = 0; x < width; x++) {
      const u = (x / width) * 2 - 1;
      const ux = u * 3.8;

      const h = fluidNoise(ux, vy);
      const hx = fluidNoise(ux + eps, vy) - fluidNoise(ux - eps, vy);
      const hy = fluidNoise(ux, vy + eps) - fluidNoise(ux, vy - eps);

      let normX = -hx / (2 * eps) * 0.8;
      let normY = -hy / (2 * eps) * 0.8;
      let normZ = 1.0;
      const nlen = Math.sqrt(normX * normX + normY * normY + 1.0);
      normX /= nlen; normY /= nlen; normZ /= nlen;

      const diff = Math.max(0, normX * nlx + normY * nly + normZ * nlz);

      const hx1 = nlx, hy1 = nly, hz1 = nlz + 1;
      const hlen = Math.sqrt(hx1 * hx1 + hy1 * hy1 + hz1 * hz1);
      const specAngle = Math.max(0, (normX * hx1 + normY * hy1 + normZ * hz1) / hlen);
      const spec = Math.pow(specAngle, 14);

      const fresnel = Math.pow(1 - Math.max(0, normZ), 3);
      const distFromCenter = Math.sqrt(u * u * 0.6 + v2);
      const vignette = Math.max(0.2, 1 - distFromCenter * 0.45);

      const baseLuma = 7 + diff * 18 + fresnel * 22;
      const r = Math.min(255, Math.floor((baseLuma * 0.9 + spec * 75) * vignette));
      const g = Math.min(255, Math.floor((baseLuma * 0.95 + spec * 95) * vignette));
      const b = Math.min(255, Math.floor((baseLuma * 1.15 + spec * 140) * vignette));

      const idx = (y * width + x) * 3;
      frameBuffer[idx] = r;
      frameBuffer[idx + 1] = g;
      frameBuffer[idx + 2] = b;
    }
  }
}

console.log("[Fluid Engine] Synthesizing frames...");
let currentFrame = 0;

function writeNextFrame() {
  while (currentFrame < totalFrames) {
    renderFrame(currentFrame);
    const canContinue = ffmpegMp4.stdin.write(frameBuffer);
    currentFrame++;

    if (currentFrame % 24 === 0) {
      console.log(`[Fluid Engine] Progress: ${currentFrame}/${totalFrames} frames (${Math.round((currentFrame/totalFrames)*100)}%)`);
    }

    if (!canContinue) {
      ffmpegMp4.stdin.once("drain", writeNextFrame);
      return;
    }
  }

  ffmpegMp4.stdin.end();
}

writeNextFrame();

ffmpegMp4.on("close", (code) => {
  console.log(`[Fluid Engine] MP4 generation complete (exit ${code})`);
  
  // Now generate WebM (VP9) and Poster (WebP) from the generated MP4
  console.log("[Fluid Engine] Transcoding high-efficiency WebM (VP9)...");
  const ffmpegWebm = spawn("ffmpeg", [
    "-y",
    "-i", "public/background.mp4",
    "-c:v", "libvpx-vp9",
    "-crf", "32",
    "-b:v", "0",
    "-an",
    "public/background.webm"
  ]);

  ffmpegWebm.on("close", () => {
    console.log("[Fluid Engine] WebM generation complete.");
    console.log("[Fluid Engine] Extracting crisp WebP poster...");
    const ffmpegPoster = spawn("ffmpeg", [
      "-y",
      "-i", "public/background.mp4",
      "-vframes", "1",
      "-q:v", "85",
      "public/background-poster.webp"
    ]);

    ffmpegPoster.on("close", () => {
      console.log("[Fluid Engine] All background assets successfully synthesized!");
      process.exit(0);
    });
  });
});
