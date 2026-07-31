# Media Assets Directory

This directory contains optional media and branding assets for the Mine Access Control System.

## Included / Expected Assets

- `global-bg.mp4` — Optional high-definition background video loop for kiosk / gate monitor displays (referenced in `DESIGN.md`).
- `logo.png` — Mine site branding logo.

## Usage

Place `global-bg.mp4` in this directory or in `static/assets/` for video background playback on monitoring wall screens. If `global-bg.mp4` is absent, the application gracefully falls back to the CSS animated gradient design tokens defined in `static/css/global-bg.css`.
