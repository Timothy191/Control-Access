#!/usr/bin/env bash
set -e

# ==============================================================================
# Control-Access Mine Management System — Setup & Bootstrap Script
# ==============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "${SCRIPT_DIR}/.." && pwd )"

cd "${PROJECT_ROOT}"

echo "======================================================================"
echo " Control-Access Mine Management System Setup"
echo "======================================================================"

# 1. Python Environment Setup
if [ ! -d ".venv" ]; then
    echo "[+] Creating Python virtual environment in .venv..."
    python3 -m venv .venv
else
    echo "[*] Python virtual environment (.venv) already exists."
fi

# Activate virtualenv
source .venv/bin/activate

# 2. Dependency Installation
echo "[+] Upgrading pip & installing dependencies..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet

# 3. Environment File (.env) Setup
if [ ! -f ".env" ]; then
    echo "[+] Copying .env.example to .env..."
    cp .env.example .env
    
    # Generate secure SECRET_KEY and HARDWARE_API_KEY
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
    HARDWARE_API_KEY=$(python3 -c "import secrets; print(secrets.token_hex(16))")
    FIELD_KEY=$(python3 -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())")
    
    # Inject generated keys into .env
    if command -v sed >/dev/null 2>&1; then
        sed -i "s/^SECRET_KEY=/SECRET_KEY=${SECRET_KEY}/" .env
        sed -i "s/^HARDWARE_API_KEY=/HARDWARE_API_KEY=${HARDWARE_API_KEY}/" .env
        sed -i "s/^FIELD_ENCRYPTION_KEY=/FIELD_ENCRYPTION_KEY=${FIELD_KEY}/" .env
    fi
    echo "[!] Created .env with auto-generated secure keys (SECRET_KEY, HARDWARE_API_KEY, FIELD_ENCRYPTION_KEY)."
else
    echo "[*] Using existing .env file."
fi

# 4. Database Initialization
echo "[+] Initializing database..."
python3 -c "from database import init_db; init_db()"

# 5. Run Verification Tests
echo "[+] Running verification tests with pytest..."
pytest

echo "======================================================================"
echo " Setup complete! To start the development server:"
echo "   source .venv/bin/activate"
echo "   python3 app.py"
echo "======================================================================"
