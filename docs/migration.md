# Migration Plan — Raspberry Pi → New Server

This covers moving thebreaksite from the Pi (100.97.28.94) to the new server.

---

## What's Moving

| Component | Source (Pi) | Destination (Server) |
|-----------|-------------|---------------------|
| App code | `/home/cooper2n/Documents/thebreaksite` | `/home/cooper2n/Documents/thebreaksite` |
| Docker volumes | `tbs_data`, `tbs_uploads`, `tbs_content`, `tbs_backups` | Same named volumes, bind to ZFS datasets |
| Environment | `.env.production` | `.env.production` (copy, then remove from git) |
| Cloudflare tunnel | Hardcoded in `docker-compose.yml` | Same |
| Nginx config | `nginx.conf` in repo | Same |
| Watchdog scripts | `infra/` in repo | Same |

---

## Pre-Migration Checklist

1. **Backup the Pi** before doing anything:
   ```bash
   # On the Pi
   cd /home/cooper2n/Documents/thebreaksite
   docker exec thebreaksite-web-1 node scripts/backup-now.js 2>/dev/null || echo "no backup script"
   
   # Backup the SQLite database
   docker exec thebreaksite-web-1 cat /app/data/receipts.db > /tmp/receipts-backup.db
   
   # Backup the uploads
   docker cp thebreaksite-web-1:/app/public/images/uploads /tmp/uploads-backup
   ```

2. **Stop the site on Pi** (optional, or just do a quick cutover at the end):
   ```bash
   docker compose down
   ```

---

## Step 1: Copy Code to New Server

On the new server:
```bash
cd /home/cooper2n
git clone <your-repo-url> Documents/thebreaksite
cd Documents/thebreaksite
```

Or copy the repo from Pi:
```bash
# On Mac (bridge between Pi and server)
rsync -avz --progress cooper2n@100.97.28.94:/home/cooper2n/Documents/thebreaksite/ \
  cooper2n@<new-server-ip>:/home/cooper2n/Documents/thebreaksite/
```

---

## Step 2: Copy Data Volumes

The Pi's Docker volumes need to transfer. Do this from the new server:

```bash
# Stop containers on the new server first
cd /home/cooper2n/Documents/thebreaksite
docker compose down
```

**Option A: rsync from Pi (recommended)**

```bash
# Create volume mount points on ZFS
sudo mkdir -p /mnt/tank/data /mnt/tank/uploads

# On Pi, find volume locations
docker volume inspect tbs_data
# Note the "Mountpoint" path, usually /var/lib/docker/volumes/tbs_data/_data

# rsync from Pi (run on new server)
rsync -avz cooper2n@100.97.28.94:/var/lib/docker/volumes/tbs_data/_data/ /mnt/tank/data/
rsync -avz cooper2n@100.97.28.94:/var/lib/docker/volumes/tbs_uploads/_data/ /mnt/tank/uploads/
```

**Option B: Docker export/import**

```bash
# On Pi: export volumes to tar files
docker run --rm -v tbs_data:/data -v /tmp:/backup alpine tar czf /backup/tbs_data.tar.gz -C /data .
docker run --rm -v tbs_uploads:/data -v /tmp:/backup alpine tar czf /backup/tbs_uploads.tar.gz -C /data .
docker run --rm -v tbs_backups:/data -v /tmp:/backup alpine tar czf /backup/tbs_backups.tar.gz -C /data .

# Copy tar files to new server
scp /tmp/tbs_*.tar.gz cooper2n@<new-server-ip>:/tmp/
```

---

## Step 3: Update docker-compose.yml

Mount ZFS datasets as bind mounts instead of Docker named volumes:

```yaml
services:
  web:
    volumes:
      - /mnt/tank/data:/app/data
      - /mnt/tank/uploads:/app/public/images/uploads
      - /mnt/tank/tbs_backups:/app/backups
      - /mnt/tank/tbs_content:/app/content  # if used

  nginx:
    volumes:
      - nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /mnt/tank/uploads:/uploads:ro
```

Remove the `volumes:` section at the bottom (named volumes no longer needed).

---

## Step 4: Copy Environment File

```bash
# From Pi or Mac
scp cooper2n@100.97.28.94:/home/cooper2n/Documents/thebreaksite/.env.production \
  /home/cooper2n/Documents/thebreaksite/.env.production
```

Verify all secrets are present:
```bash
grep -c "." .env.production
# Should have ~25-30 lines
```

**CRITICAL: Rotate all secrets after migration and remove `.env.production` from git history.**

---

## Step 5: Build and Start

```bash
cd /home/cooper2n/Documents/thebreaksite

# Build (will take 5-10 minutes on first run)
docker compose build

# Start
docker compose up -d

# Check logs
docker compose logs -f web
```

---

## Step 6: DNS Cutover

1. **Update Cloudflare DNS** — point `thebreaksurf.co.uk` to the new server's public IP
2. **Wait for propagation** (usually < 5 minutes with Cloudflare)
3. **Check the tunnel** — the Cloudflare tunnel in `docker-compose.yml` already handles routing; just make sure the new server can reach Cloudflare

If using Tailscale, update the Tailscale IP in your SSH config.

---

## Step 7: Verify

Run these checks on the new server:

```bash
# Site loads
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Should return 200

# Docker containers healthy
docker ps --format "table {{.Names}}\t{{.Status}}"
# All three should be "Up"

# SQLite database accessible
docker exec thebreaksite-web-1 ls -la /app/data/receipts.db

# Uploads visible
ls /mnt/tank/uploads/ | head

# Cloudflare tunnel working
curl -s -o /dev/null -w "%{http_code}" https://thebreaksurf.co.uk/
```

---

## Step 8: Set Up Watchdog on New Server

The `infra/` scripts are designed for the Pi (connectivity watchdog, cache watchdog). On a proper server with wired ethernet, you likely don't need the connectivity watchdog.

Copy and enable just the cache watchdog:
```bash
sudo cp infra/cache-watchdog.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/cache-watchdog.sh

sudo cp infra/cache-watchdog.service /etc/systemd/system/
sudo cp infra/cache-watchdog.timer /etc/systemd/system/

sudo systemctl enable --now cache-watchdog.timer
```

---

## Step 9: Shut Down Pi

Once the new server is confirmed working:

```bash
# On Pi
docker compose down
sudo shutdown -h now

# Unplug the Pi
```

---

## Rollback Plan

If something goes wrong:
1. Point Cloudflare DNS back to Pi IP
2. SSH into Pi and `docker compose up -d`
3. Debug on the new server

DNS rollback takes < 5 minutes with Cloudflare proxy enabled.

---

## Post-Migration Cleanup

1. **Remove `.env.production` from git** if it's tracked:
   ```bash
   git rm --cached .env.production
   git commit -m "Remove .env.production from tracking"
   ```
2. **Rotate all secrets** (Stripe, Resend, ERPNext, etc.) — they were in git history
3. **Set up GitHub Actions CI/CD** (see [cicd.md](cicd.md))
4. **Update AGENTS.md** to reflect new server instead of Pi
