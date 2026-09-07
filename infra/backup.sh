#!/bin/sh
# Nightly backup for thebreaksurf-site on the VPS.
# - MariaDB dump every night, 7-day retention
# - Uploads volume tarball on Mondays, 4-week retention
# Install: (crontab -l 2>/dev/null; echo "0 3 * * * /root/thebreaksurf-site/infra/backup.sh") | crontab -
set -e

SITE_DIR=/root/thebreaksurf-site
BACKUP_ROOT=/root/backups
STAMP=$(date +%Y%m%d)
DOW=$(date +%u)
LOG="$BACKUP_ROOT/backup.log"

mkdir -p "$BACKUP_ROOT"
log() { echo "$(date '+%F %T') $1" | tee -a "$LOG"; }

cd "$SITE_DIR"
ROOTPW=$(grep ^DB_ROOT_PASSWORD= .env | cut -d= -f2)

log "dumping database..."
docker compose exec -T db mariadb-dump -uroot -p"$ROOTPW" thebreaksite \
  | gzip > "$BACKUP_ROOT/db-$STAMP.sql.gz"
find "$BACKUP_ROOT" -name 'db-*.sql.gz' -mtime +7 -delete

if [ "$DOW" = "1" ]; then
  log "archiving uploads volume..."
  docker run --rm \
    -v thebreaksurf-site_tbs_uploads:/uploads:ro \
    -v "$BACKUP_ROOT":/backups \
    alpine tar czf "/backups/uploads-$STAMP.tgz" -C /uploads .
  find "$BACKUP_ROOT" -name 'uploads-*.tgz' -mtime +28 -delete
fi

log "done ($(du -sh "$BACKUP_ROOT" | cut -f1) total)"
