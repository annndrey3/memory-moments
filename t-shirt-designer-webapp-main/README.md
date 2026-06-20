# Memory Moments — Платформа персоналізованої продукції

> **Оновлено:** 2026-06-20 · **Статус:** production-ready (готовий до передачі).

Монорепозиторій, що містить два самостійні застосунки:

| Застосунок | Шлях | Порт | Призначення |
|---|---|---|---|
| **Конструктор** | `/` (корінь) | `5174` | 2D/3D редактор дизайну |
| **Маркетплейс** | `marketplace/` | `5173` (client) · `3001` (API) | Каталог, кошик, адмінка |

> **Спільний кошик:** конструктор і маркетплейс на одному домені користуються ОДНИМ кошиком
> (IndexedDB `mm_shop`, ідентичний `lib/sharedCart.js` в обох застосунках) — позиція, додана в
> конструкторі, видно в маркетплейсі й навпаки, і переживає навігацію між ними.

---

## Архітектура

```
memory-moments/
├── src/                        # Конструктор (Vite + React)
│   ├── components/             # DesignArea, Header, ToolsSidebar, MugModel, ProductCanvas,
│   │                           #   FrameDropdownBtn, CollageDropdownBtn, TextEditPanel,
│   │                           #   LayersDropdownBtn, BackgroundDropdownBtn,
│   │                           #   FontOptions, DesignerTour …
│   ├── hooks/                  # useTshirtCanvas, useCanvas, useAddImage, useCanvasTextureSync
│   ├── features/               # Redux slices (tshirtSlice)
│   ├── constants/              # designConstants.js (типи товарів, printZone, isMultiPhoto/isBookType,
│   │                           #   FONT_OPTIONS/FONT_GROUPS), frames.js (20 рамок), collageLayouts.js (9 шаблонів)
│   ├── lib/                    # sharedCart.js (спільний кошик IndexedDB — ІДЕНТИЧНИЙ маркетплейсному)
│   └── utils/                  # canvasStorageManager, canvasSyncManager, layerLock.js (активний-шар-only)
│
├── marketplace/
│   ├── client/                 # SPA (Vite + React Router)
│   │   └── src/
│   │       ├── pages/          # MarketplacePage, ProductDetailPage, CheckoutPage …
│   │       ├── pages/admin/    # AdminOrdersPage, AdminProductsPage, AdminSiteConfigPage …
│   │       ├── components/     # SiteHeader, SiteFooter, HeroBanner, ContactFloatingButton …
│   │       └── lib/            # api.js, cart.jsx, contacts.js, utils.js,
│   │       │                   #   sharedCart.js (спільний кошик — ІДЕНТИЧНИЙ конструкторному)
│   │
│   ├── server/                 # Express + SQLite API
│   │   └── src/
│   │       ├── routes/         # auth, products, categories, orders, upload, cleanup,
│   │       │                   #   backgrounds (фони альбомів), push (web-push) …
│   │       ├── middleware/     # auth.js, requirePermission.js
│   │       ├── config/         # db.js (better-sqlite3, foreign_keys ON)
│   │       ├── utils/          # siteConfig.js (дефолти конфігу сайту), photoDelivery.js (SFTP),
│   │       │                   #   push.js (web-push/VAPID), downloadToken.js (токен-лінк на ZIP)
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
- **IndexedDB** (`mm_shop`) — спільний з маркетплейсом кошик (`lib/sharedCart.js`); великі
  base64-позиції (мокапи, друк-файли, пачки фото) не вміщаються в localStorage

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

# Базовий URL для токен-захищеного посилання на скачування у Telegram
# (велике замовлення / фолбек при офлайн-SFTP), напр. https://memory-moments.online
PUBLIC_URL=
```

> **Безпека:** Сервер не стартує якщо `JWT_SECRET` відсутній, дорівнює прикладу або коротший за 32 символи.

> **Конфіг сайту в БД:** Telegram-токен, знижки на фотодрук та решта налаштувань також редагуються
> в адмінці (**Сайт → Налаштування сайту**) і зберігаються в таблиці `settings` (ключі `site_contacts`,
> `site_delivery`, `site_discounts`, `site_hero`, `site_seo`, `telegram`, `sftp_storage`). Значення з БД
> мають пріоритет, дефолти лежать у коді (`utils/siteConfig.js`), `.env` — резервний відкат. Міграція не потрібна.

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
| `POST` | `/api/orders` | Оформлення замовлення (типи `catalog` / `photo_print` / `design`; зберігає `subtotal`+`discount`) |
| `GET` | `/api/orders/track/:number` | Статус замовлення (для клієнта) |
| `GET` | `/api/orders/:id/photos-download?token=…` | Токен-захищене скачування ZIP фото (лінк із Telegram, коли SFTP офлайн) |
| `GET` | `/api/backgrounds` | Активні фони альбомів для конструктора |
| `GET` | `/api/site-config` | Конфіг сайту (контакти/доставка/знижки/банер/SEO; **без секретів**) |

### Адмін ендпоінти (JWT required)

| Метод | Шлях | Дозвіл | Опис |
|---|---|---|---|
| `GET` | `/api/products/admin/all` | `products.view` | Усі товари включно з прихованими |
| `POST` | `/api/products` | `products.manage` | Створити товар |
| `PUT` | `/api/products/:id` | `products.manage` | Оновити товар |
| `DELETE` | `/api/products/:id` | `products.manage` | Видалити (захист: designer_type не видаляється) |
| `GET/PUT` | `/api/categories/admin/all` | — | Управління категоріями |
| `GET` | `/api/orders` | `orders.view` | Усі замовлення (зі знижкою/підсумком) |
| `GET` | `/api/orders/:id/photos-archive` | `orders.view` | ZIP усіх файлів замовлення (принти/прев'ю/фото) |
| `GET` | `/api/orders/:id/book-archive` | `orders.view` | ZIP фотокниги (обкладинки + розвороти) |
| `PATCH` | `/api/orders/:id/status` | `orders.manage` | Змінити статус (+`reason` при скасуванні, +`tracking` ТТН при «shipped») |
| `POST` | `/api/orders/:id/notify` | `orders.manage` | Повторно надіслати клієнту лист зі статусом |
| `DELETE` | `/api/orders/:id` | **superadmin** | Видалити замовлення + print-файли |
| `GET` | `/api/admin/cleanup?days=N` | `products.manage` | Preview очистки uploads/ |
| `POST` | `/api/admin/cleanup` | `products.manage` | Видалити старі файли |
| `POST` | `/api/upload` | — | Завантажити зображення товару |
| `GET` | `/api/backgrounds/admin/all` | JWT | Усі фони альбомів |
| `POST/PUT/DELETE` | `/api/backgrounds[/:id]` | JWT | Керування фонами альбомів |
| `GET` | `/api/push/vapid-public-key` | JWT | Публічний VAPID-ключ для підписки пристрою |
| `GET` | `/api/push/status` | JWT | Кількість підписаних пристроїв |
| `POST` | `/api/push/subscribe` · `/unsubscribe` | JWT | Підписка/відписка пристрою на пуш про замовлення |
| `POST` | `/api/push/test` | JWT | Тестовий пуш власнику |
| `GET` | `/api/admin/settings/site-config` | `settings.system` | Увесь конфіг сайту для адмінки |
| `PUT` | `/api/admin/settings/site-config/:section` | `settings.system` | Зберегти секцію конфігу |
| `POST` | `/api/admin/settings/site-config/telegram/test` | `settings.system` | Тест Telegram («надіслати тест») |
| `GET/PUT` | `/api/admin/settings/storage` | `settings.system` | Конфіг SFTP-сховища (пароль маскується) |
| `POST` | `/api/admin/settings/storage/test` | `settings.system` | Перевірка SFTP-з'єднання |

---

## Адмін-панель

**URL:** `http://localhost:5173/admin`  
**Дефолтні дані:** `admin@memory-moments.local` / `admin123` *(змінити після першого входу)*

### Розділи

| Розділ | Доступ | Функціонал |
|---|---|---|
| Замовлення | `orders.view` | Перегляд, масова зміна статусу + причина скасування, ТТН Нової Пошти, бейдж знижки, скачування print-макетів, «скачати всі фото» (ZIP) + друк/накладна |
| Клієнти | `orders.view` | Список клієнтів за замовленнями |
| Товари | `products.view` | Каталог (designer_type товари приховані) |
| Категорії | `products.view` | Створення, редагування, видалення |
| Слайди | — | Банер-слайди головної |
| Фони | — | Готові фони альбомів (керують конструктором) |
| Дизайни | `designs.view` | Збережені дизайни з конструктора |
| Прайс | `services.view` | Список послуг, імпорт через Excel |
| Сайт | `settings.system` | «Налаштування сайту»: контакти/філії, доставка, знижки на фотодрук, банер/SEO, Telegram, сховище фото (SFTP) — редагується власником без розробника |
| Сповіщення | — | Web-push про нові замовлення: увімкнення на цьому пристрої, тест (VAPID-ключі генеруються автоматично) |
| Налаштування | — | Профіль, пароль, користувачі, очистка сховища |
| Посібник | — | Вбудована інструкція для власника |

Адмін-оболонка адаптивна: на телефоні бічне меню згортається у висувний drawer.

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
| `slim-book` / `print-book` | Фотокнига / альбом | 2D розвороти | Карусель мініатюр під холстом, drag-reorder, готові фони, шов + поля + підказки розміру |

Поле `designer_type` в таблиці `products` пов'язує товар з конкретним типом конструктора.

**Пачка фото (multi-photo, `isMultiPhoto`):** для фото-форматів можна завантажити багато фото одразу
(input `multiple`) — кожне редагується як окрема сторінка, але в кошик іде **однією позицією**.
Навігація сторінками — каруселлю мініатюр під холстом (з drag-reorder, мишка + тач). Знижка за
кількістю фото застосовується й до таких пачок.

**Альбом/фотокнига:** готові фони з адмінки (`BackgroundDropdownBtn`, серверна таблиця `backgrounds`),
навігація розворотами каруселлю мініатюр під холстом із drag-reorder (мишка + тач), показ зони шва +
безпечних полів + підказок розміру друку, ціна рахує кожне фото розвороту понад базу. Десктоп має
більший холст (fit-to-height через `matchMedia`), мобільний вписується без вертикального скролу, 3D-прев'ю
чашки на мобільному згортається в акордеон.

---

## Конструктор — оформлення макета

| Інструмент | Що робить | Файли |
|---|---|---|
| **Рамка** | 20 векторних рамок (без растрових ассетів). Рамка — це Fabric-група поверх зони друку, потрапляє у друкарський файл. Пікер розширюваний (можна додавати PNG-рамки). | `src/constants/frames.js`, `src/components/FrameDropdownBtn.jsx` |
| **Колаж** | 9 шаблонів розкладки (2/3/4/6 слотів). Клік по слоту → фото вписується (cover-fit) й обрізається по слоту, лишаючись рухомим і масштабованим. | `src/constants/collageLayouts.js`, `src/components/CollageDropdownBtn.jsx` |
| **Текст** | Шрифт за замовчуванням — **Caveat** (рукописний, повна кирилиця). Додавання тексту одразу вмикає редагування (можна друкувати). При виділенні з'являється плавна анімована панель `TextEditPanel` (шрифт/розмір/колір + курсив/жирний). Панель — **оверлей** поверх верху холста (absolute), тож поява/зникнення не штовхає холст. ~40 шрифтів із підтримкою кирилиці (RU + UA: і ї є ґ), згруповані (Рукописні / Без засічок / З засічками / Системні / Лише латиниця). Латиниця-only декоративні (Pacifico, Great Vibes…) лишені, але позначені «(лат.)». | `src/constants/designConstants.js` (`FONT_OPTIONS`, `FONT_GROUPS`), `src/components/FontOptions.jsx`, `src/components/TextEditPanel.jsx`; Google Fonts із кириличними сабсетами в `index.html` |
| **Шари** | Панель шарів: список усіх обʼєктів холста (зверху = передній план) з вибором, показ/сховати (👁), зміною z-порядку (вище/нижче, на перед/на зад) і видаленням. Керувати на макеті можна **лише активним** шаром — решта тимчасово блокується (`layerLock.js`), щоб при перекритті не хапати чужий обʼєкт. Фон альбому завжди заблокований. | `src/components/LayersDropdownBtn.jsx`, `src/utils/layerLock.js` |
| **Фон альбому** | Готові фони (керуються в адмінці, розділ «Фони») лягають нижнім шаром на весь формат (cover), зафіксовані. Доступно лише для фотокниг. | `src/components/BackgroundDropdownBtn.jsx`, server `backgrounds` table + `routes/backgrounds.js` |
| **Навчання** | Покроковий тур із підсвічуванням для нових відвідувачів: до 6 кроків (включно з кроком про панель «Шари»), кнопка «Пропустити навчання», показується один раз (localStorage `mm_designer_tour_v1`); відсутні на сторінці кроки автоматично пропускаються. Плавна кнопка «Підказки» повторює тур. | `src/components/DesignerTour.jsx` |

**Мобільні:** верхній/нижній ряди інструментів горизонтально прокручуються пальцем на телефонах
(вертикальні колонки на десктопі).

---

## Зв'язок конструктора з маркетплейсом

**Спільний кошик.** Конструктор і маркетплейс на одному домені користуються одним кошиком
(IndexedDB `mm_shop`, `lib/sharedCart.js` — ІДЕНТИЧНИЙ у обох). Кожна позиція самодостатня для
оформлення: `toOrderItem` будує payload для `POST /api/orders` (типи `design` / `catalog` /
`photo_print`). Окремої кнопки «Маркетплейс» у конструкторі більше немає — позиції видно в одному
кошику звідусіль. Конструктор шле замовлення напряму на `/api/orders`
(`sendOrderToMarketplace` у `utils/canvasSyncManager.js`). `EmbedBridge`/`postMessage` лишається для
вбудованого режиму, але вже не несе кошик.

При оформленні замовлення:

1. Canvas-текстури (base64 PNG) передаються як `print_front` / `print_back`
2. Сервер зберігає їх у `uploads/print_ORDER_TS_front.png`
3. URL зберігається в `order_items.design_data` (JSON)
4. Адмін скачує готові файли для друку (або весь ZIP) з картки замовлення

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

## Сповіщення

- **Web-push власнику про нові замовлення.** VAPID-ключі генеруються автоматично і зберігаються в
  налаштуваннях; пуш вмикається **на кожному пристрої окремо** в адмінці (розділ «Сповіщення»),
  є тестова кнопка. Service worker — `push-sw.js` у корені (`marketplace/client/public/push-sw.js`).
  Реалізація: `server/src/routes/push.js`, `server/src/utils/push.js`, `client/src/lib/push.js`.
- **Листи клієнту на кожну зміну статусу** (включно з причиною скасування `cancel_reason`). При
  статусі «Відправлено» вводиться ТТН Нової Пошти → у листі зʼявляється посилання для відстеження
  (колонка `orders.tracking_number`).
- **Фолбек при недоступному SFTP:** замість вкладення файлів Telegram надсилає **токен-захищене**
  посилання на скачування ZIP із власного сервера (`GET /api/orders/:id/photos-download?token=…`,
  `utils/downloadToken.js`) — потрібен `PUBLIC_URL`.

---

## Сховище фото та доставка дизайнеру (SFTP) + Telegram

Фото покупців **завжди** зберігаються на VPS (джерело істини). Додатково в адмінці
(**Сайт → Сховище фото**) можна налаштувати **SFTP-призначення** (host/port/user/password
[маскується]/віддалений шлях + увімкнення + перевірка з'єднання), щоб доставляти файли
замовлення на ПК/сервер дизайнера.

- Фоновий воркер повторює спробу **кожні 10 хв** + негайна спроба при створенні замовлення.
  Якщо призначення недоступне (напр., ПК дизайнера вимкнений уночі), замовлення лишається
  `pending` і доставляється, щойно адреса стане доступною.
- Статус доставки — у колонках `orders`: `photo_delivery_status`, `photo_delivery_at`,
  `photo_delivery_attempts`.
- Якщо у замовленні **більше 3 фото**, Telegram-сповіщення надсилає лише посилання на скачування
  (адміну), а не вкладенням усі файли; повна якість лишається на сервері/у сховищі.

Реалізація: `server/src/utils/photoDelivery.js`, `server/src/utils/siteConfig.js`.
Залежність npm: `ssh2-sftp-client`.

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
