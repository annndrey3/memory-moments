# 🚀 Деплой Memory Moments на хостинг

Инструкция по развёртыванию на **Linux-сервере (VPS, Ubuntu 22.04+)** — самый универсальный вариант.
В конце — краткий вариант для PaaS (Render/Railway + статик-хостинг).

---

## 🧱 Что разворачиваем

| Компонент | Что это | Как раздаётся в проде |
|-----------|---------|------------------------|
| **API** (`marketplace/server`) | Express + SQLite, порт 3001 | процесс под PM2, за nginx |
| **Маркетплейс + Админка** (`marketplace/client`) | статика (Vite build) | nginx раздаёт `dist/` |
| **Конструктор** (корень) | статика (Vite build) | nginx раздаёт `dist/` |

**Схема — ОДИН домен** (без CORS, один SSL):
- `https://shop.example.com/` → маркетплейс + админка
- `https://shop.example.com/designer/` → конструктор (собран с `base: "/designer/"`)
- `https://shop.example.com/api/` и `/uploads/` → проксируются на Node (127.0.0.1:3001)

> Всё на одном origin: клиент и конструктор ходят в API по относительному `/api`, поэтому
> кросс-доменных запросов и CORS не возникает. Раздачей путей занимается nginx (см. конфиг).

---

## 0. Предварительно

На сервере нужны:
```bash
# Node.js 18+ LTS (better-sqlite3 поддерживает 18–22)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Инструменты сборки для нативного модуля better-sqlite3
sudo apt-get install -y build-essential python3 git nginx

# PM2 — менеджер процессов
sudo npm install -g pm2
```

> ⚠️ **Не копируйте `node_modules` с Windows на Linux** — `better-sqlite3` собирается под ОС.
> Ставьте зависимости заново на сервере (`npm ci` / `npm install`).

---

## 1. Загрузка кода

```bash
sudo mkdir -p /var/www/memory-moments && sudo chown $USER:$USER /var/www/memory-moments
cd /var/www/memory-moments
# git clone <ваш-репозиторий> .        # либо залейте папку проекта по SFTP
# В итоге путь до кода: /var/www/memory-moments/t-shirt-designer-webapp-main
```

---

## 2. Переменные окружения (production)

### 2.1 API — `t-shirt-designer-webapp-main/marketplace/server/.env`
```ini
PORT=3001
# СГЕНЕРИРУЙТЕ свой: openssl rand -hex 32
JWT_SECRET=ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ
JWT_EXPIRES_IN=7d

# Один домен → CORS фактически не нужен, но оставим домен в списке как страховку
CORS_ORIGIN=https://shop.example.com

UPLOAD_DIR=uploads
# Логин админа (создаётся при первом запуске). СМЕНИТЕ пароль!
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=надёжный-пароль

# Telegram-уведомления о заказах (токен СЕКРЕТНЫЙ, только на сервере).
# Оставьте пустыми, чтобы отключить уведомления.
TG_BOT_TOKEN=ваш_токен_бота
TG_CHAT_ID=ваш_chat_id
```

### 2.2 Клиент — `t-shirt-designer-webapp-main/marketplace/client/.env`
```ini
# Конструктор под путём /designer того же домена (со слешем в конце!)
VITE_DESIGNER_URL=https://shop.example.com/designer
```

### 2.3 Конструктор — `t-shirt-designer-webapp-main/.env`
```ini
VITE_MARKETPLACE_URL=https://shop.example.com
# Тот же origin → относительный путь, без CORS
VITE_MARKETPLACE_API=/api
```

> 🔒 **Telegram-токен теперь на бэкенде** (`TG_BOT_TOKEN` в `.env` сервера, п. 2.1) и в публичный
> бандл **не попадает**. Заказы (и с витрины, и из конструктора) уходят в Telegram с сервера
> при создании. Конструктор лишь отправляет заказ в API (`VITE_MARKETPLACE_API`).

---

## 3. Сборка

```bash
cd /var/www/memory-moments/t-shirt-designer-webapp-main

# API (без сборки, только зависимости)
npm ci --prefix marketplace/server

# Клиент → marketplace/client/dist
npm ci --prefix marketplace/client
npm run build --prefix marketplace/client

# Конструктор → ./dist
npm ci
npm run build
```

> Если `npm ci` ругается на отсутствие lock-файла — используйте `npm install`.

---

## 4. Запуск API под PM2

```bash
cd /var/www/memory-moments

# стартуем по конфигу (создаст БД marketplace.db и засеет данные при первом запуске)
pm2 start deploy/ecosystem.config.cjs

# автозапуск после перезагрузки сервера
pm2 save
pm2 startup        # выполните команду, которую он подскажет

# проверка
pm2 logs mm-api --lines 30
curl http://127.0.0.1:3001/api/health     # {"status":"ok",...}
```

При первом старте создаётся админ из `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
Сменить пароль позже:
```bash
npm run seed-admin --prefix t-shirt-designer-webapp-main/marketplace/server
```

---

## 5. nginx

```bash
sudo cp /var/www/memory-moments/deploy/nginx.conf.example /etc/nginx/sites-available/memory-moments
sudo nano /etc/nginx/sites-available/memory-moments   # поправьте домены и пути root
sudo ln -s /etc/nginx/sites-available/memory-moments /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Готовый конфиг лежит в [deploy/nginx.conf.example](./deploy/nginx.conf.example): один server-блок —
маркетплейс на `/`, конструктор на `/designer/`, прокси `/api` и `/uploads`, SPA-fallback
(`try_files … /index.html`), `client_max_body_size 25m`.

---

## 6. HTTPS (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d shop.example.com
```
Certbot сам добавит 443-блоки и редирект с 80. Автопродление уже настроено таймером systemd.

---

## 7. Данные: персистентность и бэкапы

Файлы, которые **нельзя терять** (вне `git`, не пересоздаются):
- `t-shirt-designer-webapp-main/marketplace/server/marketplace.db` — база (товары, заказы, прайс, дизайны, админы)
- `t-shirt-designer-webapp-main/marketplace/server/uploads/` — загруженные изображения

Простой ежедневный бэкап (cron):
```bash
# crontab -e
0 3 * * * tar czf /var/backups/mm-$(date +\%F).tgz \
  /var/www/memory-moments/t-shirt-designer-webapp-main/marketplace/server/marketplace.db \
  /var/www/memory-moments/t-shirt-designer-webapp-main/marketplace/server/uploads
```

---

## 8. Обновление (редеплой новой версии)

```bash
cd /var/www/memory-moments/t-shirt-designer-webapp-main
git pull                                   # или залить новые файлы

npm ci --prefix marketplace/server         # если менялись зависимости API
npm ci --prefix marketplace/client && npm run build --prefix marketplace/client
npm ci && npm run build                    # конструктор

pm2 restart mm-api                         # перезапустить API
# nginx раздаёт свежий dist сразу, кэш браузера сбрасывается хэшами файлов
```

> Миграции БД применяются автоматически при старте API (идемпотентные `CREATE TABLE IF NOT EXISTS`
> и проверки колонок в `db.js`) — существующие данные сохраняются.

---

## ✅ Чек-лист безопасности перед запуском
- [ ] `JWT_SECRET` — длинная случайная строка (не дефолт)
- [ ] Сменён пароль админа (не `admin123`)
- [ ] `CORS_ORIGIN` содержит только ваши прод-домены
- [ ] HTTPS включён (certbot)
- [ ] Настроены бэкапы `marketplace.db` + `uploads`
- [ ] `TG_BOT_TOKEN` задан только в `.env` сервера (в публичном бандле его быть не должно)
- [ ] Firewall: открыты только 80/443 (порт 3001 — только localhost, наружу не торчит)

---

## 🌩️ Альтернатива: PaaS (без своего сервера)

- **API** → Render / Railway / Fly.io как Node-сервис:
  - Root: `t-shirt-designer-webapp-main/marketplace/server`, start: `node src/index.js`.
  - ⚠️ SQLite требует **постоянный диск** (persistent volume), смонтированный туда, где лежит
    `marketplace.db` и `uploads` — иначе данные пропадут при передеплое. На платформах без
    постоянного диска SQLite не подходит (нужен переезд на Postgres).
  - Env: те же, что в п.2.1, плюс `CORS_ORIGIN` с доменами фронтов.
- **Клиент** и **Конструктор** → Netlify / Vercel / Cloudflare Pages (статик):
  - Клиент: build `npm run build` в `marketplace/client`, publish `dist`, и **rewrite `/api/*` и
    `/uploads/*`** на URL вашего API (через настройки прокси/redirects платформы), либо задайте
    клиенту полный базовый URL API (сейчас он ходит на относительный `/api`).
  - Конструктор: build в корне, env `VITE_MARKETPLACE_API` = публичный URL API.

> Для небольшого магазина с SQLite самый простой и предсказуемый путь — **один VPS + nginx + PM2**
> (разделы 0–7). PaaS удобнее, но SQLite потребует постоянного диска или миграции на Postgres.

---

**Связанные документы:** [README.md](./README.md) (обзор + локальный запуск)
