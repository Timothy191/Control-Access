# MineGate Scanner Native App

This is a native Android application built specifically for the Chainway C66 device, supporting both Barcode and UHF RFID native hardware integration.

## Requirements
- Android Studio Ladybug (or newer)
- Chainway `DeviceAPI.jar` (Must be placed in `app/libs/` before compiling)
- JDK 17

## Building the APK
1. Open this directory (`MineGateScannerApp`) in Android Studio.
2. Wait for Gradle to sync.
3. In `NetworkClient.kt`, update the `baseUrl` to match your server's IP address.
4. Go to **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**.
5. The compiled APK will be output to `app/build/outputs/apk/debug/app-debug.apk`.

## Deploying to the C66 Scanner
You can use `adb` to install the compiled APK directly to the scanner:

```bash
# Connect the C66 via USB with USB Debugging enabled
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Launch the app
adb shell monkey -p com.mine.scanner -c android.intent.category.LAUNCHER 1
```

## How it works
- The app bypasses InfoWedge completely.
- It uses the Chainway `DeviceAPI.jar` to natively hook into the laser scanner and RFID antenna.
- When a scan is detected, it makes a direct POST request to the Mine Management System (`/api/c66` for barcodes, `/api/scan_rfid` for RFID tags).
- The app provides a large Green/Red screen overlay to give the operator immediate feedback.
