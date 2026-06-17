#!/usr/bin/env bash
# ============================================================================
#  Memory Moments — оновлення з git
#
#  Використання:
#    sudo bash update.sh
#
#  Що робить:
#    • git pull
#    • npm ci (тільки якщо змінився package-lock.json)
#    • збирає SPA
#    • перезапускає API (PM2)
# ============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

step() { echo -e "\n${BLUE}${BOLD}▶  $1${NC}"; }
ok()   { echo -e "   ${GREEN}✔  $1${NC}"; }
warn() { echo -e "   ${YELLOW}⚠  $1${NC}"; }
die()  { echo -e "\n${RED}${BOLD}✘  $1${NC}\n" >&2; exit 1; }

[[ $EUID -ne 0 ]] && die "Запустіть від root: sudo bash update.sh"

# Визначаємо директорії
INSTALL_DIR="/var/www/memory-moments"
PROJECT_DIR="$INSTALL_DIR/t-shirt-designer-webapp-main"

[[ -d "$INSTALL_DIR/.git" ]] || die "Проект не знайдено в $INSTALL_DIR. Запустіть install.sh спочатку."

echo -e "\n${BOLD}Memory Moments — оновлення${NC}"
echo "  Директорія: $INSTALL_DIR"
echo

# ─── git pull ─────────────────────────────────────────────────────────────────
step "Отримання змін з git"
cd "$INSTALL_DIR"

BEFORE=$(git rev-parse HEAD)
git pull --ff-only
AFTER=$(git rev-parse HEAD)

if [[ "$BEFORE" == "$AFTER" ]]; then
  ok "Вже актуальна версія ($(git log -1 --format='%h %s'))"
  echo
  read -rp "Все одно перезібрати і перезапустити? (y/N): " FORCE
  [[ "$FORCE" != "y" && "$FORCE" != "Y" ]] && { echo "Нічого не змінено."; exit 0; }
else
  ok "Оновлено: $(git log --oneline "$BEFORE".."$AFTER" | wc -l) нових коміт(и)"
  git log --oneline "$BEFORE".."$AFTER" | sed 's/^/     /'
fi

# ─── Залежності (тільки якщо змінився lockfile) ───────────────────────────────
check_lock_changed() {
  git diff "$BEFORE" "$AFTER" --name-only 2>/dev/null | grep -q "$1" 2>/dev/null || false
}

step "Залежності"

if check_lock_changed "t-shirt-designer-webapp-main/marketplace/server/package-lock.json"; then
  echo "   package-lock.json сервера змінився — npm ci..."
  npm ci --prefix "$PROJECT_DIR/marketplace/server" --quiet
  ok "server"
else
  ok "server — без змін"
fi

if check_lock_changed "t-shirt-designer-webapp-main/marketplace/client/package-lock.json"; then
  echo "   package-lock.json client змінився — npm ci..."
  npm ci --prefix "$PROJECT_DIR/marketplace/client" --quiet
  ok "marketplace client"
else
  ok "marketplace client — без змін"
fi

if check_lock_changed "t-shirt-designer-webapp-main/package-lock.json"; then
  echo "   package-lock.json конструктора змінився — npm ci..."
  npm ci --prefix "$PROJECT_DIR" --quiet
  ok "конструктор"
else
  ok "конструктор — без змін"
fi

# ─── Збірка ───────────────────────────────────────────────────────────────────
step "Збірка конструктора"
npm run build --prefix "$PROJECT_DIR"

step "Збірка маркетплейсу"
npm run build --prefix "$PROJECT_DIR/marketplace/client"

# ─── Перезапуск API ───────────────────────────────────────────────────────────
step "Перезапуск API (PM2)"
if pm2 describe mm-api &>/dev/null; then
  pm2 restart mm-api
  ok "mm-api перезапущено"
else
  warn "Процес mm-api не знайдено в PM2. Запуск..."
  pm2 start "$INSTALL_DIR/deploy/ecosystem.config.cjs" 2>/dev/null || \
  pm2 start "$PROJECT_DIR/marketplace/server/src/index.js" \
    --name mm-api \
    --cwd "$PROJECT_DIR/marketplace/server" \
    -- --exec_mode fork
  pm2 save
  ok "mm-api запущено"
fi

# ─── Готово ───────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}${BOLD}✔  Оновлення завершено!${NC}"
echo "   Версія: $(git -C "$INSTALL_DIR" log -1 --format='%h — %s (%cr)')"
echo "   pm2 logs mm-api — щоб переглянути логи"
echo
