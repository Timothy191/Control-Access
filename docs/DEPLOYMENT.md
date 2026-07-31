# Control-Access Mine System — Production Deployment Guide

This guide details step-by-step instructions for deploying the Control-Access system in a production environment.

## 1. Deployment Options Overview

| Mode | Database | Rate Limiting | Reverse Proxy | Use Case |
|---|---|---|---|---|
| **Docker Compose** | Azure SQL / SQLite | Redis Container | Nginx Container | Standard Production |
| **Bare Metal / VM** | Azure SQL / SQL Server | Redis Service | Nginx Systemd | High Security / On-Prem |

---

## 2. Option A: Docker Deployment (Recommended)

1. Clone the repository to `/opt/control-access`:
   ```bash
   git clone <repo-url> /opt/control-access
   cd /opt/control-access
   ```

2. Generate `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Configure required secrets in `.env`:
   ```env
   SECRET_KEY=<random-64-char-hex>
   HARDWARE_API_KEY=<random-32-char-hex>
   FIELD_ENCRYPTION_KEY=<random-base64-32-bytes>
   ADMIN_PASSWORD=<secure-admin-password>
   VISITOR_PIN=<custom-4-digit-pin>
   REDIS_URL=redis://redis:6379/0
   DATABASE_URL=mssql+pyodbc://...
   HTTPS=true
   ```

4. Start services with Docker Compose:
   ```bash
   docker compose -f docs/compose/docker-compose.prod.yml up -d --build
   ```

5. Verify running containers and health logs:
   ```bash
   docker compose -f docs/compose/docker-compose.prod.yml ps
   docker compose -f docs/compose/docker-compose.prod.yml logs -f web
   ```

---

## 3. Option B: Systemd + Nginx Bare Metal Deployment

### Step 1: Install Dependencies
```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip redis-server nginx unixodbc unixodbc-dev
```

### Step 2: Set Up System User & Application Directory
```bash
sudo useradd -r -s /bin/false accesscontrol
sudo mkdir -p /opt/control-access
sudo chown accesscontrol:accesscontrol /opt/control-access
```

### Step 3: Run Bootstrap & Configure Environment
```bash
cd /opt/control-access
bash scripts/setup.sh
```

### Step 4: Configure Systemd Service
```bash
sudo cp docs/control-access.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now redis-server
sudo systemctl enable --now control-access
```

### Step 5: Configure Nginx
```bash
sudo cp docs/nginx.conf /etc/nginx/sites-available/control-access
sudo ln -s /etc/nginx/sites-available/control-access /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 4. Verification & Health Monitoring

- Access health endpoint: `curl https://access.yourdomain.com/api/health`
- View app logs: `journalctl -u control-access -f`
- Run test suite: `pytest`
