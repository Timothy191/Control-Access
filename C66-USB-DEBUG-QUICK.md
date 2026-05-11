# C66 USB Debugging - Quick Reference

## Enable USB Debugging (One Time Setup)

1. **Settings** → **About Phone**
2. **Tap "Build Number" 7 times** (rapidly)
3. **"You are now a developer!"** appears
4. **Back** → **Developer Options**
5. **Turn ON "USB Debugging"**
6. **Connect USB cable**

## Verify ADB Connection

```bash
adb devices
```

Should show:
```
List of devices attached
<serial_number>    device
```

## Push Config Automatically

```bash
./scripts/push-c66-config.sh
```

## Result

- Config auto-pushed to C66 Downloads
- USB tethering verified
- ✅ GO FOR UNPLUG message
