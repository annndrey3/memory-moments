# Memory Moments — Маркетплейс

Окремий модуль каталогу товарів з MySQL-базою та адмін-панеллю.

## Структура

```
marketplace/
├── database/          # ER-модель, schema.sql, seed.sql
├── server/            # Express API (порт 3001)
└── client/            # React SPA — каталог + адмінка (порт 5174)
```

## Швидкий старт

### 1. База даних MySQL

```bash
mysql -u root -p < marketplace/database/schema.sql
mysql -u root -p < marketplace/database/seed.sql
```

ER-модель: [database/ER-MODEL.md](./database/ER-MODEL.md)

### 2. API-сервер

```bash
cd marketplace/server
cp .env.example .env
# Відредагуйте DB_PASSWORD та JWT_SECRET
npm install
npm run seed-admin   # створить/оновить адміна
npm run dev
```

API: `http://localhost:3001/api/health`

### 3. Клієнт маркетплейсу

```bash
cd marketplace/client
npm install
npm run dev
```

Відкрийте: `http://localhost:5174`

### 4. Конструктор (основний застосунок)

```bash
# з кореня проекту
npm run dev
```

Конструктор: `http://localhost:5173`

## Адмін-панель

- URL: `http://localhost:5174/admin`
- Логін за замовчуванням: `admin@memory-moments.local` / `admin123`

Можливості адмінки:
- Перегляд усіх товарів (активних і прихованих)
- Створення / редагування / видалення карток товару
- Завантаження зображень
- Керування варіантами (розмір, колір)
- Прив'язка до типу конструктора (`designer_type`)

## API Endpoints

| Метод | Шлях | Доступ | Опис |
|-------|------|--------|------|
| GET | `/api/products` | Public | Каталог товарів |
| GET | `/api/products/slug/:slug` | Public | Картка товару |
| GET | `/api/categories` | Public | Категорії |
| POST | `/api/auth/login` | Public | Вхід адміна |
| GET | `/api/products/admin/all` | Admin | Усі товари |
| POST | `/api/products` | Admin | Створити товар |
| PUT | `/api/products/:id` | Admin | Оновити товар |
| DELETE | `/api/products/:id` | Admin | Видалити товар |
| POST | `/api/upload` | Admin | Завантажити зображення |

## Змінні середовища

**server/.env**
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=memory_moments_marketplace
JWT_SECRET=your-secret
CORS_ORIGIN=http://localhost:5174
```

**client/.env** (опційно)
```
VITE_DESIGNER_URL=http://localhost:5173
```

**Корінь проекту (.env)** — для посилання на маркетплейс з конструктора:
```
VITE_MARKETPLACE_URL=http://localhost:5174
```

## Зв'язок з конструктором

Поле `designer_type` у товарі відповідає ключам з `src/constants/designConstants.js` (`crew-neck`, `mug`, тощо). Кнопка «Створити дизайн» на сторінці товару відкриває конструктор з потрібним типом продукту.
