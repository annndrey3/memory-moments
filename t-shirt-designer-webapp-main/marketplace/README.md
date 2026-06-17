# Memory Moments — Маркетплейс

Модуль каталогу, кошика та адмін-панелі. Працює разом з конструктором дизайну (корінь проекту).

## Структура

```
marketplace/
├── client/               # React SPA (Vite, порт 5173)
│   └── src/
│       ├── pages/        # Публічні сторінки
│       ├── pages/admin/  # Адмін-панель (/admin/*)
│       ├── components/   # SiteHeader, SiteFooter, ContactFloatingButton …
│       └── lib/          # api.js, cart.jsx, contacts.js
│
├── server/               # Express API (порт 3001)
│   └── src/
│       ├── routes/       # auth, products, categories, orders, upload, cleanup …
│       ├── middleware/   # auth.js, requirePermission.js
│       ├── config/       # db.js (SQLite, foreign_keys ON)
│       └── scripts/      # seed-admin, cleanUploads.js
│
└── database/
    ├── schema.sql        # Структура таблиць
    └── ER-MODEL.md       # Діаграма зв'язків
```

---

## Швидкий старт

### 1. API-сервер

```bash
cd marketplace/server
cp .env.example .env
# Відредагуйте .env — обов'язково змініть JWT_SECRET
npm install
npm run seed-admin    # Ініціалізує БД і створює адміна
npm run dev           # http://localhost:3001
```

Перевірка: `curl http://localhost:3001/api/health`

### 2. Клієнт

```bash
cd marketplace/client
npm install
npm run dev           # http://localhost:5173
```

### 3. Або з кореня проекту

```bash
npm run marketplace:install   # одноразово
npm run marketplace:api       # сервер
npm run marketplace:web       # клієнт
```

---

## Змінні середовища

### `server/.env`

```env
PORT=3001
JWT_SECRET=           # Обов'язково: мінімум 32 випадкових символи
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5174,http://localhost:5173
UPLOAD_DIR=uploads

# Seed-дані для першого адміна
ADMIN_EMAIL=admin@memory-moments.local
ADMIN_PASSWORD=admin123

# Telegram-сповіщення (опційно)
TG_BOT_TOKEN=
TG_CHAT_ID=
```

> Сервер **не запуститься** якщо `JWT_SECRET` відсутній або коротший за 32 символи.

### `client/.env` (опційно)

```env
VITE_DESIGNER_URL=http://localhost:5174
```

---

## База даних

**Тип:** SQLite (`marketplace.db` у папці `server/`)  
**Бібліотека:** `better-sqlite3`, `foreign_keys = ON`

### Таблиці

| Таблиця | Призначення |
|---|---|
| `admins` | Адміністратори (email, bcrypt-пароль, роль, дозволи JSON) |
| `categories` | Категорії товарів (ієрархія через `parent_id`) |
| `products` | Товари (`designer_type` → прив'язка до конструктора) |
| `product_images` | Зображення товарів (кілька на товар, `is_primary`) |
| `product_variants` | Варіанти (розмір, колір, price_modifier) |
| `orders` | Замовлення клієнтів |
| `order_items` | Позиції замовлення (`design_data` JSON — дані конструктора) |
| `designs` | Збережені дизайни з конструктора |
| `service_categories` / `service_items` | Прайс-лист |
| `admin_settings` | Системні налаштування (Gemini API ключ тощо) |
| `product_audit_logs` | Журнал змін товарів |

### Поле `designer_type`

Пов'язує товар з типом продукту в конструкторі:

```
crew-neck   → Футболка (2 боки, 3D preview)
mug         → Чашка (розгортка, 3D preview)
polaroid    → Полароїд
instax-mini → Instax Mini
photo-*     → Фотопродукція (7 форматів)
```

Товари з `designer_type IS NOT NULL`:
- **Не відображаються** у публічному каталозі та адмін-списку товарів
- **Не видаляються** через API (захист від випадкового видалення)
- **Не враховуються** у лічильнику товарів категорії

---

## Адмін-панель

**URL:** `http://localhost:5173/admin`  
**Дефолт:** `admin@memory-moments.local` / `admin123`

### Можливості

**Замовлення** (`/admin/orders`)
- Перегляд усіх замовлень зі статусами
- Зміна статусу: pending → paid → shipped → completed / cancelled
- Для замовлень конструктора: скачування PNG макетів для друку (Спереду / Ззаду)
- Видалення замовлення (тільки superadmin) — автоматично чистить print-файли

**Товари** (`/admin/products`)
- Список активних/прихованих товарів
- Створення та редагування (назва, ціна, категорія, зображення, варіанти)
- Кнопка видалення заблокована для `designer_type` товарів

**Категорії** (`/admin/categories`)
- Створення, редагування, зміна порядку
- При видаленні категорії `designer_type` товари автоматично переміщуються в іншу категорію

**Дизайни** (`/admin/designs`) — збережені роботи з конструктора

**Прайс** (`/admin/services`) — послуги та ціни, імпорт з Excel через Gemini AI

**Налаштування** (`/admin/settings`)
- Зміна email / пароля
- Управління користувачами та їх дозволами (superadmin)
- Gemini API ключ для імпорту прайсу
- Очистка сховища — видалення старих print/photo файлів

### Система дозволів

```
superadmin  → повний доступ, включно з видаленням замовлень і управлінням юзерами
admin       → тільки призначені дозволи:
  orders.view / orders.manage
  products.view / products.manage
  designs.view / designs.manage
  services.view / services.manage
  settings.system
```

---

## API ендпоінти

### Публічні

```
GET    /api/health
GET    /api/categories
GET    /api/products               ?category=&search=&page=&limit=
GET    /api/products/slug/:slug
POST   /api/auth/login             { email, password } → { token }
POST   /api/orders                 Оформлення замовлення
GET    /api/orders/:number         Статус замовлення для клієнта
GET    /api/services               Прайс-лист
POST   /api/photos                 Завантаження фото клієнта (rate-limited)
```

### Адмін (Authorization: Bearer <token>)

```
GET    /api/products/admin/all     ?search=&page=
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id           (заборонено для designer_type)

GET    /api/categories/admin/all
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id

GET    /api/orders/admin           ?status=&page=
PATCH  /api/orders/:id/status      { status }
DELETE /api/orders/:id             (тільки superadmin)

POST   /api/upload                 multipart/form-data → { url }

GET    /api/admin/cleanup          ?days=30  (preview)
POST   /api/admin/cleanup          { days }  (виконати)

GET/PUT/DELETE /api/admin/settings/*
```

---

## Файли uploads/

Сервер зберігає в `UPLOAD_DIR` (default: `marketplace/server/uploads/`):

| Префікс | Що | Коли чистити |
|---|---|---|
| `print_*` | PNG макети для друку з конструктора | Після виконання замовлення (30+ днів) |
| `photo-*` | Фото клієнтів для фото-замовлень | Після виконання (30+ днів) |
| Інші | Зображення товарів | Ніколи автоматично |

**Автоматична очистка** через адмінку (Налаштування → Очистка сховища) або вручну:

```bash
# Перевірка без видалення
node src/scripts/cleanUploads.js --days=30 --dry-run

# Видалення
node src/scripts/cleanUploads.js --days=30
```

---

## Інтеграція з конструктором

1. Кнопка «Персоналізувати» на сторінці товару відкриває конструктор в `<iframe>`
2. Конструктор отримує `?type=crew-neck` (або інший `designer_type`)
3. Після завершення дизайну клієнт натискає «Замовити»
4. Canvas-текстури передаються через `postMessage` → маркетплейс оформлює замовлення
5. Сервер зберігає PNG файли, посилання записує в `order_items.design_data`
6. Адмін бачить посилання «Друк — Спереду / Ззаду» у картці замовлення

---

## Скрипти

```bash
# Сервер
npm run dev           # Запуск з --watch (hot reload)
npm run start         # Запуск без watch (production)
npm run seed-admin    # Ініціалізація БД + seed адміна

# Клієнт
npm run dev           # Vite dev server (порт 5173)
npm run build         # Збірка в dist/
npm run preview       # Перегляд збірки
```
