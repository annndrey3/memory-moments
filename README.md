# 🎨 Memory Moments — Custom Merch Designer & Marketplace

Full-stack платформа для создания и продажи кастомизированных товаров (футболки, чашки, фотопечать) с интерактивным 2D/3D конструктором, маркетплейсом и админ-панелью.

**[Деплой](./DEPLOYMENT.md)** · **[Маркетплейс docs](./t-shirt-designer-webapp-main/marketplace/README.md)**

> **Корень проекта:** весь код находится в `t-shirt-designer-webapp-main/`.
> Папка `medusa-develop/` — отдельный клон Medusa.js, в текущей сборке **не используется**.

---

## 🧩 Архитектура

Проект состоит из **трёх независимых приложений**, которые связаны между собой:

| Компонент | Путь | Стек | Порт |
|-----------|------|------|------|
| 🎨 **Конструктор** (designer) | `t-shirt-designer-webapp-main/` (корень) | React 18, Redux Toolkit, **Fabric.js**, **Three.js** | **5174** |
| 🛍️ **Маркетплейс + Админка** | `t-shirt-designer-webapp-main/marketplace/client/` | React 18, Vite, React Router 7, Fabric.js | **5173** |
| ⚙️ **API** | `t-shirt-designer-webapp-main/marketplace/server/` | Express 5, **SQLite** (better-sqlite3), JWT | **3001** |

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

> ⚠️ **База данных — SQLite**, файл `marketplace/server/marketplace.db` создаётся автоматически
> при первом запуске. **Никакие MySQL / PostgreSQL / Docker не требуются** (упоминания
> PostgreSQL в старых доках устарели).

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
JWT_SECRET=change-me-in-production-use-long-random-string
JWT_EXPIRES_IN=7d
# список разрешённых origin через запятую (клиент + конструктор)
CORS_ORIGIN=http://localhost:5174,http://localhost:5173
UPLOAD_DIR=uploads
ADMIN_EMAIL=admin@memory-moments.local
ADMIN_PASSWORD=admin123
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

## 🗄️ База данных (SQLite)

Файл: `marketplace/server/marketplace.db`. Схема создаётся при первом запуске
(`src/config/db.js`), включая идемпотентную самомиграцию таблицы `designs` и колонки
`products.design_id` для старых баз.

**Таблицы:** `admins`, `categories`, `products`, `product_images`, `product_variants`,
`product_audit_logs`, `designs`.

Просмотр БД (например, через DB Browser for SQLite) — просто откройте файл `marketplace.db`.

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
| POST/PUT/DELETE | `/api/products[/:id]` | token | CRUD товаров |
| GET | `/api/designs` · `/api/designs/:id` | public | список / дизайн |
| POST/PUT/DELETE | `/api/designs[/:id]` | token | CRUD дизайнов |
| POST | `/api/orders` | public | оформить заказ (цены пересчитываются на сервере) |
| GET | `/api/orders/track/:number` | public | заказ по номеру (страница подтверждения) |
| GET | `/api/orders` · `/api/orders/:id` | token | список / детали заказа |
| PATCH | `/api/orders/:id/status` | token | смена статуса заказа |
| GET | `/api/services` | public | прайс-лист (категории + услуги) |
| GET | `/api/services/admin/all` | token | весь прайс (вкл. скрытое) |
| POST/PUT/DELETE | `/api/services/categories[/:id]` | token | CRUD категорий прайса |
| POST/PUT/DELETE | `/api/services[/:id]` | token | CRUD услуг прайса |
| POST | `/api/upload` | token | загрузка изображения |

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
  категорий и услуг). Данные засеяны из `Цены m&m.xls` → `server/src/data/priceList.json`
  (9 категорий, 108 услуг), автосид при первом запуске

### В планах ⚠️
- [ ] Управление категориями из админки (CRUD UI)
- [ ] Сохранение готового макета покупателя (fabric_data) в позицию заказа
- [ ] Онлайн-оплата (LiqPay / Stripe) вместо ручного подтверждения
- [ ] Реалистичные шейдеры материалов (глянцевая чашка, матовая ткань)
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

**Last Updated:** 2026-06-14 · **Status:** 🟢 Конструктор + маркетплейс + админка + корзина/заказы — интеграция завершена
