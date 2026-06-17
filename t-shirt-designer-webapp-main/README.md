# Memory Moments — Платформа персоналізованої продукції

Монорепозиторій, що містить два самостійні застосунки:

| Застосунок | Шлях | Порт | Призначення |
|---|---|---|---|
| **Конструктор** | `/` (корінь) | `5174` | 2D/3D редактор дизайну |
| **Маркетплейс** | `marketplace/` | `5173` (client) · `3001` (API) | Каталог, кошик, адмінка |

---

## Архітектура

```
memory-moments/
├── src/                        # Конструктор (Vite + React)
│   ├── components/             # DesignArea, Header, ToolsSidebar, MugModel, ProductCanvas …
│   ├── hooks/                  # useTshirtCanvas, useCanvas, useAddImage, useCanvasTextureSync
│   ├── features/               # Redux slices (tshirtSlice)
│   ├── constants/              # designConstants.js — типи товарів, printZone, SVG-шляхи
│   └── utils/                  # canvasStorageManager, canvasSyncManager
│
├── marketplace/
│   ├── client/                 # SPA (Vite + React Router)
│   │   └── src/
│   │       ├── pages/          # MarketplacePage, ProductDetailPage, CheckoutPage …
│   │       ├── pages/admin/    # AdminOrdersPage, AdminProductsPage, AdminSettingsPage …
│   │       ├── components/     # SiteHeader, SiteFooter, HeroBanner, ContactFloatingButton …
│   │       └── lib/            # api.js, cart.jsx, contacts.js, utils.js
│   │
│   ├── server/                 # Express + SQLite API
│   │   └── src/
│   │       ├── routes/         # auth, products, categories, orders, upload, cleanup …
│   │       ├── middleware/     # auth.js, requirePermission.js
│   │       ├── config/         # db.js (better-sqlite3, foreign_keys ON)
│   │       └── scripts/        # cleanUploads.js, seed-admin
│   │
│   └── database/               # ER-MODEL.md, schema.sql
│
├── public/                     # Статика конструктора (3D-моделі, шрифти, favicon)
├── .env.example
├── vite.config.js              # Конструктор: base=/designer/, port=5174
└── package.json                # Кореневі скрипти + скрипти маркетплейсу
```

---

## Технічний стек

### Конструктор
- **React 18** + **Vite 6**
- **Fabric.js 6** — 2D canvas (текст, зображення, лінії, clipPath)
- **Three.js** + **React Three Fiber** — 3D preview (футболка, чашка)
- **Redux Toolkit** — UI-стан (колір, вибраний вид)
- **React Context** — стан canvas між компонентами
- **localStorage** — автозбереження дизайну між сесіями

### Маркетплейс
- **React 18** + **React Router 7** + **Vite 6**
- **Express 5** + **better-sqlite3** (SQLite, `foreign_keys ON`)
- **JWT** (jsonwebtoken) — авторизація адмінки
- **Multer** — завантаження файлів у `uploads/`
- **Helmet** + **express-rate-limit** — безпека API
- **Tailwind CSS 3** + **Radix UI** / **Shadcn** — UI
- **Lucide React** — іконки

---

## Швидкий старт (розробка)

### 1. Встановлення залежностей

```bash
# Конструктор
npm install

# Маркетплейс (один раз)
npm run marketplace:install
```

### 2. Середовище

```bash
# Корінь — для конструктора
cp .env.example .env

# Сервер маркетплейсу
cp marketplace/server/.env.example marketplace/server/.env
# Обов'язково змініть JWT_SECRET (мінімум 32 символи)
```

### 3. Ініціалізація бази даних

```bash
cd marketplace/server
npm run seed-admin      # Створює адміна та seed-дані
```

### 4. Запуск

```bash
# Термінал 1 — Конструктор (http://localhost:5174)
npm run dev

# Термінал 2 — API сервер (http://localhost:3001)
npm run marketplace:api

# Термінал 3 — Маркетплейс SPA (http://localhost:5173)
npm run marketplace:web
```

---

## Змінні середовища

### Корінь `.env`

```env
VITE_MARKETPLACE_URL=http://localhost:5173
VITE_MARKETPLACE_API=/api
VITE_ALLOWED_PARENT_ORIGINS=http://localhost:5174,http://localhost:5173
```

### `marketplace/server/.env`

```env
PORT=3001
JWT_SECRET=              # ОБОВ'ЯЗКОВО: мінімум 32 випадкових символи
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5174,http://localhost:5173
UPLOAD_DIR=uploads       # Папка для зображень (абсолютний або відносний шлях)

# Адмін за замовчуванням (тільки для seed-admin)
ADMIN_EMAIL=admin@memory-moments.local
ADMIN_PASSWORD=admin123

# Telegram-сповіщення про нові замовлення (опційно)
TG_BOT_TOKEN=
TG_CHAT_ID=
```

> **Безпека:** Сервер не стартує якщо `JWT_SECRET` відсутній, дорівнює прикладу або коротший за 32 символи.

### `marketplace/client/.env` (опційно)

```env
VITE_DESIGNER_URL=http://localhost:5174
```

---

## API маркетплейсу

### Публічні ендпоінти

| Метод | Шлях | Опис |
|---|---|---|
| `GET` | `/api/health` | Перевірка сервера |
| `GET` | `/api/categories` | Активні категорії з кількістю товарів |
| `GET` | `/api/products` | Каталог (пагінація, фільтр, пошук) |
| `GET` | `/api/products/slug/:slug` | Картка товару |
| `POST` | `/api/auth/login` | Вхід адміна → JWT |
| `POST` | `/api/orders` | Оформлення замовлення |
| `GET` | `/api/orders/:number` | Статус замовлення (для клієнта) |

### Адмін ендпоінти (JWT required)

| Метод | Шлях | Дозвіл | Опис |
|---|---|---|---|
| `GET` | `/api/products/admin/all` | `products.view` | Усі товари включно з прихованими |
| `POST` | `/api/products` | `products.manage` | Створити товар |
| `PUT` | `/api/products/:id` | `products.manage` | Оновити товар |
| `DELETE` | `/api/products/:id` | `products.manage` | Видалити (захист: designer_type не видаляється) |
| `GET/PUT` | `/api/categories/admin/all` | — | Управління категоріями |
| `GET` | `/api/orders/admin` | `orders.view` | Усі замовлення |
| `PATCH` | `/api/orders/:id/status` | `orders.manage` | Змінити статус |
| `DELETE` | `/api/orders/:id` | **superadmin** | Видалити замовлення + print-файли |
| `GET` | `/api/admin/cleanup?days=N` | `products.manage` | Preview очистки uploads/ |
| `POST` | `/api/admin/cleanup` | `products.manage` | Видалити старі файли |
| `POST` | `/api/upload` | — | Завантажити зображення товару |

---

## Адмін-панель

**URL:** `http://localhost:5173/admin`  
**Дефолтні дані:** `admin@memory-moments.local` / `admin123` *(змінити після першого входу)*

### Розділи

| Розділ | Доступ | Функціонал |
|---|---|---|
| Замовлення | `orders.view` | Перегляд, зміна статусу, скачування print-макетів |
| Товари | `products.view` | Каталог (designer_type товари приховані) |
| Категорії | — | Створення, редагування, видалення |
| Дизайни | `designs.view` | Збережені дизайни з конструктора |
| Прайс | `services.view` | Список послуг, імпорт через Excel |
| Налаштування | superadmin | Профіль, пароль, користувачі, Gemini API, очистка сховища |

### Система дозволів

- **superadmin** — повний доступ без обмежень, видалення замовлень
- **admin** — вибіркові дозволи (view / manage) на кожен розділ
- Нові користувачі стартують без дозволів — superadmin призначає

---

## Конструктор — типи продуктів

Визначені у `src/constants/designConstants.js`:

| Ключ | Назва | Перегляд | Особливість |
|---|---|---|---|
| `crew-neck` | Футболка | 2D + 3D | Передня/задня сторони, printZone |
| `mug` | Чашка | 2D розгортка + 3D | Wrap-текстура на циліндрі |
| `polaroid` | Полароїд | 2D flat | Квадратна зона друку |
| `instax-mini` | Instax Mini | 2D flat | Формат 54×86 мм |
| `photo-*` | Фото (7 форматів) | 2D flat | 10×15, 15×21, A4, квадрат тощо |

Поле `designer_type` в таблиці `products` пов'язує товар з конкретним типом конструктора.

---

## Зв'язок конструктора з маркетплейсом

Конструктор вбудовується через `<iframe>` і спілкується з батьківською сторінкою через `postMessage` (компонент `EmbedBridge`). При оформленні замовлення:

1. Canvas-текстури (base64 PNG) передаються як `print_front` / `print_back`
2. Сервер зберігає їх у `uploads/print_ORDER_TS_front.png`
3. URL зберігається в `order_items.design_data` (JSON)
4. Адмін скачує готові файли для друку з картки замовлення

---

## Очистка сховища

Файли `print_*` і `photo-*` в `uploads/` накопичуються з часом.

**З адмінки:** Налаштування → Очистка сховища → вибрати кількість днів → Перевірити → Видалити

**Вручну:**
```bash
# Preview (не видаляє)
node marketplace/server/src/scripts/cleanUploads.js --days=30 --dry-run

# Фактичне видалення
node marketplace/server/src/scripts/cleanUploads.js --days=30
```

Захист: зображення товарів та файли замовлень молодших N днів не видаляються.

---

## Production deployment

Рекомендована схема через nginx reverse proxy:

```nginx
# Маркетплейс SPA (зібраний dist/)
location / {
    root /var/www/memory-moments/marketplace/client/dist;
    try_files $uri $uri/ /index.html;
}

# API
location /api/ {
    proxy_pass http://localhost:3001;
}

# Завантажені файли
location /uploads/ {
    proxy_pass http://localhost:3001;
}

# Конструктор (зібраний dist/)
location /designer/ {
    root /var/www/memory-moments/dist;
    try_files $uri $uri/ /designer/index.html;
}
```

**Збірка:**
```bash
# Конструктор
npm run build

# Маркетплейс SPA
cd marketplace/client && npm run build

# Старт сервера
cd marketplace/server && node src/index.js
```
