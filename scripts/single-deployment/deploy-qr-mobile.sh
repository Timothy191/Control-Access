#!/bin/bash
# Deploy QR Mobile App Terminal

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
export SCRIPT_DIR

echo "Starting QR Mobile App Terminal..."

# Check if QrMobile directory exists
if [[ -d "$PROJECT_DIR/QrMobile" ]]; then
    gnome-terminal \
        --title="[3] QR Mobile - Expo Scanner" \
        --working-directory="$PROJECT_DIR/QrMobile" \
        -- bash -c "source ../venv/bin/activate && npx expo start --clear" &
    echo "QR Mobile Terminal launched"
else
    echo "Error: QrMobile directory not found"
    exit 1
fi
