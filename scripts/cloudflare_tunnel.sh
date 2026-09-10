#!/usr/bin/env bash
set -eo pipefail

DIR="/home/server/Projects/Control-Access"
URL_FILE="$DIR/public_url.txt"
JSON_FILE="$DIR/tunnel_info.json"
LOG_FILE="$DIR/tunnel.log"

echo "[$(date -Iseconds)] Starting Cloudflare Quick Tunnel for Control-Access on port 8080..." > "$LOG_FILE"
rm -f "$URL_FILE" "$JSON_FILE"

LOCATION="JNB (Johannesburg)"
PROTOCOL="QUIC / HTTP/2"
CONNECTOR_ID=""

exec cloudflared tunnel --url http://127.0.0.1:8080 2>&1 | while read -r line; do
    echo "$line" >> "$LOG_FILE"
    if [[ "$line" =~ location=([a-zA-Z0-9]+) ]]; then
        LOCATION="${BASH_REMATCH[1]^^}"
    fi
    if [[ "$line" =~ protocol=([a-zA-Z0-9]+) ]]; then
        PROTOCOL="${BASH_REMATCH[1]^^}"
    fi
    if [[ "$line" =~ Generated\ Connector\ ID:\ ([a-zA-Z0-9-]+) ]]; then
        CONNECTOR_ID="${BASH_REMATCH[1]}"
    fi
    if [[ "$line" =~ (https://[a-zA-Z0-9.-]+\.trycloudflare\.com) ]]; then
        PUB_URL="${BASH_REMATCH[1]}"
        echo "$PUB_URL" > "$URL_FILE"
        cat <<JSON > "$JSON_FILE"
{
  "public_url": "$PUB_URL",
  "provider": "cloudflare",
  "active": true,
  "edge_location": "$LOCATION",
  "protocol": "$PROTOCOL",
  "encryption": "Edge TLS 1.3 / Post-Quantum",
  "connector_id": "$CONNECTOR_ID",
  "updated_at": "$(date -Iseconds)"
}
JSON
        echo "[$(date -Iseconds)] Cloudflare Public URL acquired: $PUB_URL (Location: $LOCATION, Protocol: $PROTOCOL)" >> "$LOG_FILE"
    fi
done

