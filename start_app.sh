#!/bin/bash

# Arch-System Startup Script
# This script activates the virtual environment and starts the app.

echo "Starting Arch-System..."

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

# Validate required environment variables
if [ -z "$SECRET_KEY" ]; then
    echo "WARNING: SECRET_KEY not set. Set via .env or export."
fi

if [ -z "$OLLAMA_CLOUD_API_KEY" ] && [ "$OLLAMA_USE_CLOUD" = "true" ]; then
    echo "WARNING: OLLAMA_USE_CLOUD=true but OLLAMA_CLOUD_API_KEY not set."
fi

# Start the application
echo "Starting Flask application..."
python app.py