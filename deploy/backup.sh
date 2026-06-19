#!/usr/bin/env bash
# ============================================================================
#  Memory Moments — резервне копіювання: Postgres (pg_dump) + завантажені файли.
#
#  print-макети у uploads/ — це ВИРОБНИЧІ артефакти, яких НЕМАЄ в БД, тож бекап
#  БД без них неповний. Цей скрипт зберігає і базу, і файли, та чистить старі копії.
#
#  Вручну:  bash deploy/backup.sh
#  Cron:    chmod +x deploy/backup.sh
#           crontab -e →  30 3 * * * /var/www/memory-moments/deploy/backup.sh >> /var/log/mm-backup.log 2>&1
#
#  Налаштування через env (необовʼязково):
#    MM_BACKUP_DIR=/path            (куди класти, default <repo>/backups)
#    MM_BACKUP_RETENTION_DAYS=14    (скільки днів тримати)
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT/t-shirt-designer-webapp-main/marketplace/server"
BACKUP_DIR="${MM_BACKUP_DIR:-$ROOT/backups}"
RETENTION_DAYS="${MM_BACKUP_RETENTION_DAYS:-14}"

# Беремо прод-креди (DATABASE_URL, UPLOAD_DIR) з .env сервера.
if [ -f "$SERVER_DIR/.env" ]; then
  set -a; . "$SERVER_DIR/.env"; set +a
fi
UPLOAD_DIR="${UPLOAD_DIR:-$SERVER_DIR/uploads}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

# 1) База даних
if [ -n "${DATABASE_URL:-}" ]; then
  echo "[backup] pg_dump → db-$STAMP.sql.gz"
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"
else
  echo "[backup] SQLite copy → db-$STAMP.db (DATABASE_URL не задано)"
  cp "$SERVER_DIR/marketplace.db" "$BACKUP_DIR/db-$STAMP.db" 2>/dev/null || echo "[backup] SQLite db not found, skip"
fi

# 2) Завантажені файли (print-макети + прев'ю)
if [ -d "$UPLOAD_DIR" ]; then
  echo "[backup] tar uploads → uploads-$STAMP.tar.gz"
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
else
  echo "[backup] UPLOAD_DIR '$UPLOAD_DIR' не знайдено, skip"
fi

# 3) Ротація старих копій
echo "[backup] retention: видаляю старше за $RETENTION_DAYS днів"
find "$BACKUP_DIR" -type f \( -name 'db-*' -o -name 'uploads-*' \) -mtime +"$RETENTION_DAYS" -delete

echo "[backup] done → $BACKUP_DIR"
