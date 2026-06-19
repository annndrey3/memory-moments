#!/usr/bin/env bash
# ============================================================================
#  Memory Moments — one-click installer
#  Ubuntu 20.04+ / Debian 11+
#
#  Використання:
#    sudo bash install.sh
#
#  Що робить:
#    • встановлює Node.js 20, nginx, certbot, PM2
#    • клонує репозиторій
#    • створює .env файли
#    • збирає SPA (конструктор + маркетплейс)
#    • запускає API через PM2 (автозапуск при перезавантаженні)
#    • налаштовує nginx з Let's Encrypt HTTPS
# ============================================================================

set -euo pipefail

# ─── Кольори ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

step() { echo -e "\n${BLUE}${BOLD}▶  $1${NC}"; }
ok()   { echo -e "   ${GREEN}✔  $1${NC}"; }
warn() { echo -e "   ${YELLOW}⚠  $1${NC}"; }
die()  { echo -e "\n${RED}${BOLD}✘  ПОМИЛКА: $1${NC}\n" >&2; exit 1; }

# ─── Перевірки ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && die "Запустіть від root: sudo bash install.sh"
grep -qiE 'ubuntu|debian' /etc/os-release 2>/dev/null \
  || warn "Скрипт тестувався на Ubuntu/Debian — на інших ОС можуть бути відмінності"

echo -e "\n${CYAN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║   Memory Moments — Інсталятор  v1.0         ║"
echo "║   Маркетплейс · Конструктор · API            ║"
echo -e "╚══════════════════════════════════════════════╝${NC}"
echo

# ─── Збір параметрів ──────────────────────────────────────────────────────────
read -rp "  Git repo URL (https://github.com/…): " GIT_REPO
[[ -z "$GIT_REPO" ]] && die "Git repo URL обов'язковий"

read -rp "  Домен (напр. shop.example.com): " DOMAIN
[[ -z "$DOMAIN" ]] && die "Домен обов'язковий"

read -rp "  Email для SSL сертифіката (Let's Encrypt): " SSL_EMAIL
[[ -z "$SSL_EMAIL" ]] && die "Email для SSL обов'язковий"

read -rp "  Email адміна [${SSL_EMAIL}]: " ADMIN_EMAIL
ADMIN_EMAIL="${ADMIN_EMAIL:-$SSL_EMAIL}"

while true; do
  read -rsp "  Пароль адміна (мін. 8 символів): " ADMIN_PASSWORD; echo
  [[ ${#ADMIN_PASSWORD} -ge 8 ]] && break
  echo "  ✘ Занадто короткий, спробуй ще раз"
done

echo
read -rp "  Telegram Bot Token (Enter — пропустити): " TG_BOT_TOKEN
TG_CHAT_ID=""
[[ -n "$TG_BOT_TOKEN" ]] && read -rp "  Telegram Chat ID: " TG_CHAT_ID

# ─── Константи ────────────────────────────────────────────────────────────────
INSTALL_DIR="/var/www/memory-moments"
PROJECT_DIR="$INSTALL_DIR/t-shirt-designer-webapp-main"
NODE_MAJOR=20

echo
echo -e "  ${BOLD}Директорія:${NC} $INSTALL_DIR"
echo -e "  ${BOLD}Домен:${NC}      https://$DOMAIN"
echo -e "  ${BOLD}Адмін:${NC}      $ADMIN_EMAIL"
echo
read -rp "  Все правильно? Починаємо? (y/N): " CONFIRM
[[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]] && { echo "Скасовано."; exit 0; }

# ─── Системні пакети ──────────────────────────────────────────────────────────
step "Оновлення системи та базові пакети"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx openssl sudo postgresql postgresql-contrib build-essential python3
ok "Базові пакети встановлені"
# build-essential + python3 — потрібні node-gyp для компіляції нативного
# better-sqlite3 (готового бінарника під деякі версії Node немає). У проді
# використовується PostgreSQL, але npm усе одно збирає всі залежності.

# ─── Node.js ──────────────────────────────────────────────────────────────────
step "Node.js $NODE_MAJOR"
NODE_CURRENT=$(node -e "process.stdout.write(process.versions.node.split('.')[0])" 2>/dev/null || echo "0")
if [[ "$NODE_CURRENT" -ge "$NODE_MAJOR" ]]; then
  ok "Node.js $(node -v) вже встановлено"
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null 2>&1
  apt-get install -y nodejs >/dev/null 2>&1
  ok "Node.js $(node -v) встановлено"
fi

# ─── PM2 ──────────────────────────────────────────────────────────────────────
step "PM2 (менеджер процесів)"
if command -v pm2 &>/dev/null; then
  ok "PM2 $(pm2 -v) вже є"
else
  npm install -g pm2 --quiet
  ok "PM2 $(pm2 -v) встановлено"
fi

# ─── Клонування репозиторію ───────────────────────────────────────────────────
step "Клонування репозиторію"
mkdir -p "$INSTALL_DIR"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  warn "Репозиторій вже існує — виконуємо git pull"
  git -C "$INSTALL_DIR" pull --ff-only
else
  git clone "$GIT_REPO" "$INSTALL_DIR"
fi
ok "Код → $INSTALL_DIR"

# ─── PostgreSQL ───────────────────────────────────────────────────────────────
step "PostgreSQL — створення бази даних"
systemctl enable --now postgresql >/dev/null 2>&1 || true

DB_NAME="memory_moments"
DB_USER="mm_app"
DB_PASS=$(openssl rand -hex 24)   # лише hex — безпечно в DATABASE_URL без екранування

# Роль (ідемпотентно). Пароль завжди синхронізуємо з тим, що піде в .env нижче.
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1; then
  sudo -u postgres psql -qc "ALTER ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';"
else
  sudo -u postgres psql -qc "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';"
fi

# База (ідемпотентно) з власником-роллю.
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  sudo -u postgres psql -qc "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
fi

DATABASE_URL="postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
ok "PostgreSQL: база '$DB_NAME', користувач '$DB_USER' (пароль згенеровано автоматично)"

# ─── Секрети ──────────────────────────────────────────────────────────────────
JWT_SECRET=$(openssl rand -hex 48)

# ─── .env файли ───────────────────────────────────────────────────────────────
step "Конфігурація (.env)"

# API server
cat > "$PROJECT_DIR/marketplace/server/.env" <<ENV
PORT=3001
NODE_ENV=production
DATABASE_URL=$DATABASE_URL
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://$DOMAIN
UPLOAD_DIR=uploads
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
TG_BOT_TOKEN=$TG_BOT_TOKEN
TG_CHAT_ID=$TG_CHAT_ID
ENV
chmod 600 "$PROJECT_DIR/marketplace/server/.env"

# Constructor
cat > "$PROJECT_DIR/.env" <<ENV
VITE_MARKETPLACE_URL=https://$DOMAIN
VITE_MARKETPLACE_API=/api
VITE_ALLOWED_PARENT_ORIGINS=https://$DOMAIN
ENV

# Marketplace client
cat > "$PROJECT_DIR/marketplace/client/.env" <<ENV
VITE_DESIGNER_URL=https://$DOMAIN/designer
ENV

ok ".env файли створено (server .env захищено chmod 600)"

# ─── Залежності ───────────────────────────────────────────────────────────────
step "npm install — API сервер"
npm ci --prefix "$PROJECT_DIR/marketplace/server" --quiet

step "npm install — маркетплейс (client)"
npm ci --prefix "$PROJECT_DIR/marketplace/client" --quiet

step "npm install — конструктор"
npm ci --prefix "$PROJECT_DIR" --quiet

# ─── Ініціалізація БД ─────────────────────────────────────────────────────────
step "Ініціалізація схеми, адміна та демо-даних"
cd "$PROJECT_DIR/marketplace/server"
npm run seed-admin           # створює схему (PostgreSQL) + адміна з паролем
npm run seed-data            # демо-каталог + прайс-лист (ідемпотентно, DB-agnostic)
ok "Схему створено, адмін $ADMIN_EMAIL налаштований, прайс-лист і каталог завантажено"

# ─── Збірка SPA ───────────────────────────────────────────────────────────────
step "Збірка конструктора (Vite build)"
npm run build --prefix "$PROJECT_DIR"

step "Збірка маркетплейсу (Vite build)"
npm run build --prefix "$PROJECT_DIR/marketplace/client"

# ─── Права на папку uploads ───────────────────────────────────────────────────
mkdir -p "$PROJECT_DIR/marketplace/server/uploads"

# ─── PM2 запуск ───────────────────────────────────────────────────────────────
step "Запуск API через PM2"
pm2 delete mm-api 2>/dev/null || true
pm2 delete mm-ecosystem 2>/dev/null || true   # прибрати помилково названий процес із попередніх версій

# Файл МАЄ закінчуватися на .config.cjs — інакше PM2 трактує його як звичайний
# скрипт (запускає сам конфіг, а не src/index.js) і процес одразу падає.
cat > /tmp/ecosystem.config.cjs <<ECOSYSTEM
module.exports = {
  apps: [{
    name: "mm-api",
    cwd: "$PROJECT_DIR/marketplace/server",
    script: "src/index.js",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "300M",
    env: { NODE_ENV: "production" }
  }]
};
ECOSYSTEM

pm2 start /tmp/ecosystem.config.cjs
pm2 save

# Автозапуск PM2 при перезавантаженні сервера
PM2_STARTUP_CMD=$(env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | grep "sudo" | tail -1)
[[ -n "$PM2_STARTUP_CMD" ]] && eval "$PM2_STARTUP_CMD" || warn "Автозапуск PM2 — налаштуйте вручну: pm2 startup"
ok "API запущено. Перевірка: pm2 logs mm-api"

# ─── nginx ────────────────────────────────────────────────────────────────────
step "nginx конфігурація"
NGINX_SITE="/etc/nginx/sites-available/memory-moments"

cat > "$NGINX_SITE" <<NGINX
# Боти соцмереж/месенджерів отримують серверний пререндер OG-тегів.
# map {} тут у http-контексті (sites-enabled включаються всередину http {}).
map \$http_user_agent \$mm_is_bot {
    default                 0;
    "~*facebookexternalhit" 1;
    "~*Facebot"             1;
    "~*Twitterbot"          1;
    "~*TelegramBot"         1;
    "~*WhatsApp"            1;
    "~*Viber"               1;
    "~*Slackbot"            1;
    "~*Discordbot"          1;
    "~*LinkedInBot"         1;
    "~*Pinterest"           1;
    "~*Googlebot"           1;
    "~*bingbot"             1;
}

server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Маркетплейс SPA (dist/)
    root $PROJECT_DIR/marketplace/client/dist;
    index index.html;

    # 250 MB — замовлення з конструктора несуть base64 макетів (фотокниги = багато розворотів)
    client_max_body_size 250m;

    # ── API ──────────────────────────────────────────────────────────────────
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }

    # ── Завантажені файли ─────────────────────────────────────────────────────
    location /uploads/ {
        proxy_pass       http://127.0.0.1:3001;
        proxy_set_header Host \$host;
    }

    # ── Конструктор (/designer/) ──────────────────────────────────────────────
    location = /designer { return 301 /designer/; }
    location /designer/ {
        alias $PROJECT_DIR/dist/;
        try_files \$uri \$uri/ /designer/index.html;
    }

    # ── Сторінки товару: ботам — SSR, людям — SPA ────────────────────────────
    location ~ ^/product/ {
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        if (\$mm_is_bot) {
            proxy_pass http://127.0.0.1:3001;
        }
        try_files \$uri \$uri/ /index.html;
    }

    # ── Маркетплейс SPA ───────────────────────────────────────────────────────
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/memory-moments
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "nginx запущено"

# ─── SSL (Let's Encrypt) ──────────────────────────────────────────────────────
step "SSL сертифікат (Let's Encrypt)"
echo
warn "DNS для $DOMAIN повинен вже вказувати на цей сервер!"
echo "  Натисни Enter щоб продовжити або Ctrl+C щоб вийти"
read -r

certbot --nginx \
  -d "$DOMAIN" -d "www.$DOMAIN" \
  --non-interactive --agree-tos \
  -m "$SSL_EMAIL" \
  --redirect

ok "HTTPS активовано. Сертифікат оновлюється автоматично (systemd timer)"

# ─── Зберегти конфіг встановлення ────────────────────────────────────────────
cat > "$INSTALL_DIR/.install-info" <<INFO
DOMAIN=$DOMAIN
INSTALL_DIR=$INSTALL_DIR
PROJECT_DIR=$PROJECT_DIR
ADMIN_EMAIL=$ADMIN_EMAIL
INSTALLED_AT=$(date -Iseconds)
INFO
chmod 600 "$INSTALL_DIR/.install-info"

# ─── Готово ───────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   ✔  Memory Moments успішно встановлено!                    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║   🌐 Сайт:         https://%-35s║\n" "$DOMAIN "
printf "║   🔧 Адмінка:      https://%-35s║\n" "$DOMAIN/admin/login "
printf "║   🎨 Конструктор:  https://%-35s║\n" "$DOMAIN/designer "
printf "║   💚 API health:   https://%-35s║\n" "$DOMAIN/api/health "
echo "╠══════════════════════════════════════════════════════════════╣"
printf "║   📧 Логін:  %-48s║\n" "$ADMIN_EMAIL "
echo "║   🔑 Пароль: (вказаний при встановленні)                    ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║   pm2 logs mm-api        — live-логи API                   ║"
echo "║   pm2 restart mm-api     — перезапуск API                  ║"
echo "║   sudo bash update.sh    — оновлення з git                 ║"
echo -e "╚══════════════════════════════════════════════════════════════╝${NC}"
