#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD_TOOLS="$ROOT_DIR/android-tools-cache/build-tools/34.0.0"
ANDROID_JAR="$ROOT_DIR/android-tools-cache/android.jar"
BUILD_DIR="$ROOT_DIR/android-builder"
OUT_APK="$ROOT_DIR/public/downloads/c66-scanner-bridge.apk"

echo "=== Building Chainway C66 Android Companion APK ==="

mkdir -p "$BUILD_DIR/gen" "$BUILD_DIR/bin" "$BUILD_DIR/dex" "$ROOT_DIR/public/downloads"

# Step 1: Compile Resources
echo "-> [1/6] Compiling Android resources with AAPT2..."
"$BUILD_TOOLS/aapt2" compile --dir "$BUILD_DIR/res" -o "$BUILD_DIR/compiled_res.zip"

# Step 2: Link Resources & Manifest
echo "-> [2/6] Linking resources and generating R.java..."
"$BUILD_TOOLS/aapt2" link \
    -I "$ANDROID_JAR" \
    --manifest "$BUILD_DIR/AndroidManifest.xml" \
    -o "$BUILD_DIR/unaligned.apk" \
    "$BUILD_DIR/compiled_res.zip" \
    --java "$BUILD_DIR/gen" \
    --auto-add-overlay

# Step 3: Compile Java Sources
echo "-> [3/6] Compiling Java classes with javac..."
javac -cp "$ANDROID_JAR:$BUILD_DIR/gen" \
    -d "$BUILD_DIR/bin" \
    -source 8 -target 8 \
    "$BUILD_DIR/src/com/mine/c66bridge"/*.java \
    "$BUILD_DIR/gen/com/mine/c66bridge"/R.java

# Step 4: DEX compilation with D8
echo "-> [4/6] Generating DEX bytecode with D8..."
"$BUILD_TOOLS/d8" \
    --lib "$ANDROID_JAR" \
    --min-api 24 \
    --output "$BUILD_DIR/dex" \
    "$BUILD_DIR/bin/com/mine/c66bridge"/*.class

# Add classes.dex to APK archive
cd "$BUILD_DIR/dex"
zip -u "$BUILD_DIR/unaligned.apk" classes.dex
cd "$ROOT_DIR"

# Step 5: 4-byte ZIP alignment
echo "-> [5/6] Aligning APK with zipalign..."
"$BUILD_TOOLS/zipalign" -f -p 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

# Step 6: Sign APK with debug key
echo "-> [6/6] Signing APK with apksigner (v1 + v2 + v3 schemes)..."
KEYSTORE="$BUILD_DIR/debug.keystore"
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkeypair \
        -keystore "$KEYSTORE" \
        -storepass android \
        -keypass android \
        -alias androiddebugkey \
        -dname "CN=Control-Access,O=Mining,C=ZA" \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000
fi

"$BUILD_TOOLS/apksigner" sign \
    --ks "$KEYSTORE" \
    --ks-pass pass:android \
    --ks-key-alias androiddebugkey \
    --key-pass pass:android \
    --v1-signing-enabled true \
    --v2-signing-enabled true \
    --v3-signing-enabled true \
    --out "$OUT_APK" \
    "$BUILD_DIR/aligned.apk"

echo "-> Verifying signed APK..."
"$BUILD_TOOLS/apksigner" verify --verbose "$OUT_APK"

echo "=== SUCCESS: APK generated at $OUT_APK ==="
ls -lh "$OUT_APK"
