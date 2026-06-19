# 🎨 Memory Moments — Custom Merch Designer & Marketplace

Full-stack платформа для создания и продажи кастомизированных товаров (футболки, чашки, фотопечать, **фотокниги Slim/Print Book**) с интерактивным 2D/3D конструктором, маркетплейсом и админ-панелью.

**[Деплой](./DEPLOYMENT.md)** · **[Маркетплейс docs](./t-shirt-designer-webapp-main/marketplace/README.md)**

> **Корень проекта:** весь код находится в `t-shirt-designer-webapp-main/`.
> Папка `medusa-develop/` — отдельный клон Medusa.js, в текущей сборке **не используется**.

---

## 🧩 Архитектура

Проект состоит из **трёх независимых приложений**, которые связаны между собой:

| Компонент | Путь | Стек | Порт |
|-----------|------|------|------|
| 🎨 **Конструктор** (designer) | `t-shirt-designer-webapp-main/` (корень) | React 18, Redux Toolkit, **Fabric.js**, **Three.js**, react-pageflip | **5174** |
| 🛍️ **Маркетплейс + Админка** | `t-shirt-designer-webapp-main/marketplace/client/` | React 18, Vite, React Router 7, Fabric.js | **5173** |
| ⚙️ **API** | `t-shirt-designer-webapp-main/marketplace/server/` | Express 5, **SQLite/PostgreSQL**, JWT, jimp+jszip (фотокниги) | **3001** |

```
┌──────────────────┐   iframe + postMessage   ┌──────────────────┐
│   Админка (5173) │◄────────────────────────►│ Конструктор (5174)│
│  DesignerModal   │   load / export / design  │   EmbedBridge    │
└────────┬─────────┘                           └─────────┬────────┘
         │ REST (designs, products)                      │ GET /designs/:id (по ?designId)
         ▼                                               ▼
┌────────────────────────────────────────────────────────────────┐
│                       API (3001) · SQLite                        │
└────────────────────────────────────────────────────────────────┘
         ▲
         │ REST (каталог, товар)
┌────────┴─────────┐
│ Маркетплейс(5173)│  кнопка «Створити дизайн» → 5174?type=…&designId=…
└──────────────────┘
```

> ⚠️ **Локально — SQLite** (файл `marketplace/server/marketplace.db`, создаётся автоматически,
> Docker не нужен). **В продакшене — PostgreSQL**: задайте `DATABASE_URL` в `.env`, и сервер
> переключится на `pg`. Единый слой `src/config/db.js` поддерживает оба движка через
> `query()`/`transaction()` — пишите кросс-СУБД SQL (SQLite скрывает Postgres-only ошибки).

---

## 🚀 Быстрый старт

```bash
cd t-shirt-designer-webapp-main

# 1. Зависимости конструктора (корень)
npm install

# 2. Зависимости маркетплейса (server + client)
npm run marketplace:install
```

Запуск в **трёх терминалах** (или используйте `start_project.bat`):

```bash
# Терминал 1 — API (порт 3001, БД создаётся автоматически)
npm run marketplace:api

# Терминал 2 — Маркетплейс + Админка (порт 5173)
npm run marketplace:web

# Терминал 3 — Конструктор (порт 5174)
npm run dev
```

**Адреса:**
- Маркетплейс: <http://localhost:5173>
- Админка: <http://localhost:5173/admin/login>
- Конструктор: <http://localhost:5174>
- API health: <http://localhost:3001/api/health>

**Вход в админку (по умолчанию):**
```
email:    admin@memory-moments.local
password: admin123
```
Сменить пароль: `npm run seed-admin --prefix marketplace/server` (с заданными `ADMIN_EMAIL`/`ADMIN_PASSWORD` в `.env`).

---

## 🔗 Как работает интеграция (конструктор ↔ маркетплейс ↔ админка)

Связка построена на отдельном приложении-конструкторе, встраиваемом в админку через `<iframe>` и обменивающемся данными через `postMessage`.

### 1. Админ создаёт дизайн
1. В админке: **Товари → форма товару → тип конструктора** или раздел **Дизайни → Новий дизайн**.
2. Открывается `DesignerModal` с `<iframe src="…:5174?embed=1&type=<тип>">` — это **реальный конструктор** в embed-режиме (`marketplace/client/src/components/DesignerModal.jsx`).
3. Админ рисует макет → жмёт **«Зберегти дизайн»**.
4. Админка шлёт конструктору `{ type: "export" }`; `EmbedBridge` (`src/components/EmbedBridge.jsx`) сериализует переднее полотно Fabric.js (`canvas.toJSON()`) + превью (`canvas.toDataURL()`) и возвращает `{ type: "design", payload }`.
5. Админка сохраняет дизайн через `POST/PUT /api/designs` (имя берётся из поля модалки).

> 🛟 Если конструктор не запущен (порт 5174 недоступен), в модалке есть резервный
> режим **ручного JSON** — дизайн всё равно можно сохранить.

### 2. Дизайн привязывается к товару
В форме товара поле `design_id` (компонент `DesignSelector`) хранит выбранный дизайн. Сохраняется в `products.design_id`.

### 3. Покупатель кастомизирует товар
На странице товара кнопка **«Створити дизайн»** ведёт на `…:5174?type=<тип>&designId=<id>`. Конструктор (тот же `EmbedBridge`) подтягивает дизайн из `GET /api/designs/:id` и загружает его на полотно как стартовый макет.

### Протокол postMessage

| Направление | Сообщение |
|-------------|-----------|
| admin → designer | `{ source:"mm-admin", type:"load", fabricData }` |
| admin → designer | `{ source:"mm-admin", type:"export" }` |
| designer → admin | `{ source:"mm-designer", type:"ready" }` |
| designer → admin | `{ source:"mm-designer", type:"design", payload:{ fabricData, previewImage, productType } }` |

---

## ⚙️ Конфигурация (.env)

**API** — `marketplace/server/.env` (см. `.env.example`):
```ini
PORT=3001
JWT_SECRET=change-me-in-production-use-long-random-string   # ≥32 симв., иначе сервер не стартует
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5174,http://localhost:5173      # разрешённые origin (клиент + конструктор)
UPLOAD_DIR=uploads
ADMIN_EMAIL=admin@memory-moments.local
ADMIN_PASSWORD=admin123
# Прод: PostgreSQL (без переменной — SQLite). Telegram/SMTP — опционально.
DATABASE_URL=postgres://user:pass@host:5432/db
TG_BOT_TOKEN=        # токен бота для уведомлений о заказах (только на сервере, не в бандле)
TG_CHAT_ID=          # чат владельца
# SMTP_HOST / SMTP_USER / SMTP_PASS — email-подтверждение покупателю (опц.)
```

**Маркетплейс/клиент** — `marketplace/client/.env`:
```ini
VITE_DESIGNER_URL=http://localhost:5174
```

**Конструктор** — `.env` в корне `t-shirt-designer-webapp-main`:
```ini
VITE_MARKETPLACE_URL=http://localhost:5173
VITE_MARKETPLACE_API=http://localhost:3001/api
```

Лимиты валидатора изображений и размер рабочей области — в `src/config/designer.config.js`:
```js
export const DESIGNER_CONFIG = {
  minWidthPx: 1000,   // мин. ширина фото для валидатора DPI
  minHeightPx: 1000,
  targetDPI: 300,
  canvasBoundingBox: { width: 400, height: 500 }, // зона печати
};
```

---

## 🗄️ База данных (SQLite dev / PostgreSQL prod)

Единый слой `src/config/db.js` поддерживает оба движка: без `DATABASE_URL` — SQLite
(`marketplace/server/marketplace.db`, создаётся при первом запуске), с `DATABASE_URL` —
PostgreSQL (`pg`). Схема и **идемпотентные** миграции применяются на каждом старте
(`ADD COLUMN IF NOT EXISTS` / `PRAGMA`-проверки), поэтому деплой не требует ручных шагов с БД.

**Таблицы:** `admins`, `categories`, `products`, `product_images`, `product_variants`,
`product_audit_logs`, `designs`, `orders`, `order_items`, `service_categories`, `services`,
`settings`, `slides`, `customers`.

Колонки `orders` (добавляются идемпотентной миграцией): `idempotency_key` (защита от дублей),
`notify_status` (`pending`/`sent`/`failed` — доставка Telegram-уведомления), `discount` (скидка
на фотопечать по количеству), `archive_url`/`archive_status` (ZIP-архив фотокниги, собирается
в фоне). Макет и метаданные позиции (fabric JSON, URL print-файлов, `innerPhotos` книги и
`book`-мета) хранятся в `order_items.design_data` (JSON).

Просмотр dev-БД — откройте `marketplace.db` (например, в DB Browser for SQLite).

---

## 🌐 REST API (основное)

| Метод | Endpoint | Доступ | Описание |
|-------|----------|--------|----------|
| POST | `/api/auth/login` | public | вход админа, возвращает JWT |
| GET | `/api/auth/me` | token | текущий админ |
| GET | `/api/categories` | public | категории |
| GET | `/api/products` | public | каталог (фильтры: `category`, `featured`, `search`) |
| GET | `/api/products/slug/:slug` | public | товар по slug (+ данные дизайна) |
| GET | `/api/products/admin/all` | token | все товары (вкл. скрытые) |
| GET | `/api/products/designer-prices` | public | цены конструктора (футболка/полотно/фотокниги Slim·Print) из прайса |
| POST/PUT/DELETE | `/api/products[/:id]` | token | CRUD товаров |
| GET | `/api/designs` · `/api/designs/:id` | public | список / дизайн |
| POST/PUT/DELETE | `/api/designs[/:id]` | token | CRUD дизайнов |
| POST | `/api/orders` | public | оформить заказ (цены — на сервере; принимает заголовок `Idempotency-Key`) |
| GET | `/api/orders/track/:number` | public | статус заказа по номеру (**без PII**), rate-limited |
| GET | `/api/orders` · `/api/orders/:id` | token | список / детали заказа |
| PATCH | `/api/orders/:id/status` | token | смена статуса (с коррекцией склада) |
| POST | `/api/orders/:id/notify` | token | повторно отправить уведомление в Telegram |
| GET | `/api/orders/:id/book-archive` | token | ZIP фотокниги (обложки + готовые печатные страницы) |
| GET | `/api/services` | public | прайс-лист (категории + услуги) |
| GET | `/api/services/admin/all` | token | весь прайс (вкл. скрытое) |
| POST/PUT/DELETE | `/api/services/categories[/:id]` | token | CRUD категорий прайса |
| POST/PUT/DELETE | `/api/services[/:id]` | token | CRUD услуг прайса |
| POST | `/api/upload` · `/api/photos` | token | загрузка изображения / фото |
| GET/POST/PUT/DELETE | `/api/slides[/:id]` | public GET / token | слайды баннера маркетплейса |
| GET/POST | `/api/admin/data/export/:kind` · `import/:kind` | token | Excel-экспорт/импорт (товары/прайс/категории/клиенты) |
| GET/PATCH/DELETE | `/api/admin/customers[/:id]` | token | CRM клиентов |
| GET | `/api/health` | public | health-check: пинг БД, `503` если БД недоступна |

---

## 🖼️ Конструктор: товары и фотокниги

**Типы товаров** (`src/constants/designConstants.js`): футболка (перёд/зад, А4/А3, белая/чёрная),
чашки (5 видов), фотоформаты (полароид, Instax, фото 10×15…А4, квадрат), полотно на подрамнике
(размеры из прайса), **Slim Book** и **Print Book** (фотокниги). Цены тянутся из прайса
(`services`) и **пересчитываются на сервере** при заказе — клиентскую цену сервер не принимает.

**Фотокниги (Slim/Print Book):**
- Обложка **перёд** и **зад** — отдельные вкладки в редакторе (дизайн на Fabric-canvas).
- Формат **20×20 / 21×30 / 25×25**, базовые **10/15** разворотов (Slim) / листов (Print) + «+доп.».
- Загрузка фото разворотов; **полноэкранный предпросмотр** с перелистыванием страниц
  (`react-pageflip`), сворачиванием в плавающую кнопку и **управлением порядком** фото
  (перетаскивание мышью + кнопки ‹ › для тача).
- Цена из прайса: Slim — коды `1136/1137/1138`, Print — `1135/1132/1133`.
- При заказе сервер **в фоне** собирает **ZIP-архив** (`jimp` + `jszip`): обложки + каждый
  разворот, разложенный на готовую печатную страницу **2528×3425 px @300 dpi** (21,4×29 см),
  поля **1 см корешок / 0,5 см** остальные, зеркально левая/правая, нумерация `page-NN-R/L`.
  Готовый архив скачивается из админки заказа (мгновенно; для старых — собирается on-demand).

**Скидка на фотопечать по количеству** (`photo_print`): 50→5%, 100→10%, 150→15%, 200→20%,
300→25%, 400+→30%. Считается на сервере (хранится в `orders.discount`), показывается в корзине
и чекауте; таблица — на странице `/prices`.

---

## 🛡️ Надёжность и безопасность

Бэкенд прошёл аудит-хардненинг (ветка `hardening/order-audit`):
- **Идемпотентность заказа** — клиент шлёт стабильный `Idempotency-Key`; повтор после
  таймаута возвращает существующий заказ, а не дубль.
- **Без утечки PII** — публичный `track/:number` отдаёт только статус/позиции/суммы
  (порядковые номера больше нельзя перебрать ради контактов клиентов).
- **Корректность заказа** — печатные файлы пишутся только после коммита (нет orphan'ов,
  имя файла с индексом позиции), уведомления (Telegram/email) вынесены за ответ клиенту,
  `DELETE` заказа возвращает склад, лимит позиций и защита от некорректной цены.
- **Экспорт/загрузка** — экранирование формул в Excel-экспорте, расширение файла из mimetype.
- **Наблюдаемость** — глубокий `/api/health` (`503` при мёртвой БД), структурные JSON-логи
  запросов, статус доставки уведомления (`notify_status`) с ручной переотправкой.

Эксплуатация (бэкап, ротация логов, мониторинг, отдача `/uploads` через nginx) —
см. [deploy/OPS.md](./deploy/OPS.md) и [deploy/backup.sh](./deploy/backup.sh).

---

## 📊 Статус разработки

### Готово ✅
- 2D Canvas редактор (Fabric.js) + 3D превью (Three.js)
- Маркетплейс: каталог, страница товара
- Админка: JWT-авторизация, CRUD товаров, изображения, варианты, категории (чтение)
- **Designs API** (создание/чтение/обновление/удаление) — починен и работает
- **Интеграция конструктор ↔ админка** через iframe + postMessage (`DesignerModal` ↔ `EmbedBridge`)
- **Связка товар → конструктор** по `?type=&designId=` с подгрузкой дизайна из API
- Привязка `design_id` к товару (`DesignSelector`)
- **Корзина и оформление заказов:** корзина в localStorage (`CartProvider`), выбор варианта,
  чекаут, страница подтверждения, серверный пересчёт цен (`orders`/`order_items`)
- **Управление заказами в админке:** список с фильтром по статусу, детали, смена статуса
  (pending → paid → shipped → completed / cancelled)
- **Заказы → админка + Telegram (с сервера):** все заказы (и с витрины, и из конструктора)
  сохраняются в общую систему заказов и уведомление о них шлёт **бэкенд** в Telegram
  (`TG_BOT_TOKEN`/`TG_CHAT_ID` в `.env` сервера — токен секретный, в клиентский бандл не
  попадает). Заказы из конструктора помечены бейджем «Конструктор», прев'ю макетов уходит
  в Telegram фото; цена кастомного товара подтягивается по `designer_type` из каталога
- **Прайс-лист / страница цен:** публичная страница `/prices` (категории, форматы, цена
  розница + Instagram, условия), управление прайсом в админке (`/admin/services` — CRUD
  категорий и услуг). Данные засеяны из `Цены m&m.xls` → `server/src/data/priceList.json`,
  автосид при первом запуске
- **Фотокниги Slim/Print Book:** обложка перёд/зад, развороты/листы, загрузка фото,
  полноэкранный предпросмотр с перелистыванием, управление порядком фото, **фоновая сборка
  ZIP-архива** (готовые печатные страницы 300 dpi с полями, L/R) для скачивания в админке
- **Скидка на фотопечать по количеству** (50→5%…400+→30%) — расчёт на сервере, показ в корзине, таблица на `/prices`
- **Сохранение макета покупателя** (fabric JSON + print-файлы + фото книги) в `order_items.design_data`
- **Аудит-хардненинг:** идемпотентность заказа, `track` без PII, наблюдаемость
  (`/api/health` 503, JSON-логи запросов, `notify_status` с ручной переотправкой), ops
  (бэкап `pg_dump`+`uploads`, `OPS.md`, фикс `update.sh`)

### В планах ⚠️
- [ ] Онлайн-оплата (LiqPay / Stripe) вместо ручного подтверждения
- [ ] Реалистичные шейдеры материалов (глянцевая чашка, матовая ткань)
- [ ] Фоновая очередь с ретраями для тяжёлых задач (архивы больших книг, уведомления)
- [ ] Интеграция с внешними e-commerce (Shopify / WooCommerce) — опционально

---

## 📚 Документация

| Гайд | Описание |
|------|----------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 🚀 Деплой на хостинг (VPS + nginx + PM2, и PaaS) |
| [marketplace/README.md](./t-shirt-designer-webapp-main/marketplace/README.md) | Маркетплейс: API, база данных, адмін-панель |
| [t-shirt-designer-webapp-main/README.md](./t-shirt-designer-webapp-main/README.md) | Конструктор + маркетплейс: повная документация |

> 📝 Локальный запуск описан в разделе [«Быстрый старт»](#-быстрый-старт) выше.

---

## 🤝 Contributing

1. `git checkout -b feature/your-feature`
2. `git commit -m 'feat: your feature'`
3. `git push origin feature/your-feature`
4. Open Pull Request

## 📄 License

MIT — см. `LICENSE`.

---

**Last Updated:** 2026-06-19 · **Status:** 🟢 Интеграция + фотокниги (Slim/Print Book, предпросмотр, ZIP-печать), скидки на фотопечать, аудит-хардненинг и ops
