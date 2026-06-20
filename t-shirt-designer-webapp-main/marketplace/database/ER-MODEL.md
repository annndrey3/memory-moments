# ER-модель маркетплейсу Memory Moments

**База даних:** SQLite (dev, `marketplace/server/marketplace.db`) / **PostgreSQL** (prod, `DATABASE_URL`)  
**Шар:** `src/config/db.js` — єдиний `query()`/`transaction()` для обох рушіїв (джерело істини схеми).  
**Останнє оновлення:** 2026-06-20

> Схема + ідемпотентні міграції застосовуються автоматично на старті сервера
> (`ADD COLUMN IF NOT EXISTS` на Postgres, `PRAGMA table_info` + `ALTER TABLE` на SQLite),
> тож запуск проти наявної БД сам себе доліковує до актуальної схеми.
> Усі `created_at`/`updated_at` зберігаються в **UTC** (`CURRENT_TIMESTAMP`).

---

## Діаграма сутностей

```mermaid
erDiagram
    %% Каталог
    categories ||--o{ categories      : "parent_id (self)"
    categories ||--o{ products        : contains
    designs    ||--o{ products        : "design_id"
    products   ||--o{ product_images  : has
    products   ||--o{ product_variants : has
    products   ||--o{ product_audit_logs : tracks
    admins     ||--o{ product_audit_logs : creates

    %% Замовлення
    orders         ||--|{ order_items    : contains
    products       ||--o{ order_items    : "product_id (nullable)"
    product_variants ||--o{ order_items  : "variant_id (nullable)"
    designs        ||--o{ order_items    : "design_id (nullable)"

    %% Прайс-лист
    service_categories ||--|{ services : contains

    admins {
        int     id              PK
        text    email           UK
        text    password_hash
        text    name
        text    role            "admin | superadmin"
        text    permissions     "JSON array | NULL = superadmin"
        datetime created_at
        datetime updated_at
    }

    categories {
        int     id          PK
        text    name
        text    slug        UK
        text    description
        int     parent_id   FK
        int     sort_order
        int     is_active
        datetime created_at
        datetime updated_at
    }

    products {
        int     id                  PK
        int     category_id         FK
        text    name
        text    slug                UK
        text    short_description
        text    description
        real    price
        real    compare_at_price
        text    sku                 UK
        int     stock_quantity
        text    designer_type       "crew-neck | mug | polaroid | ..."
        int     design_id           FK
        int     is_active
        int     is_featured
        datetime created_at
        datetime updated_at
    }

    designs {
        int     id              PK
        text    name            UK
        text    description
        text    product_type    "crew-neck | mug | polaroid | ..."
        text    fabric_data     "Fabric.js JSON"
        text    preview_image   "base64 або URL"
        int     width
        int     height
        datetime created_at
        datetime updated_at
    }

    product_images {
        int     id          PK
        int     product_id  FK
        text    image_url
        text    alt_text
        int     sort_order
        int     is_primary
        datetime created_at
    }

    product_variants {
        int     id              PK
        int     product_id      FK
        text    attribute_name  "size | color | ..."
        text    attribute_value "S / M / L / Білий / ..."
        real    price_modifier
        int     stock_quantity
        text    sku             UK
        datetime created_at
        datetime updated_at
    }

    product_audit_logs {
        int     id          PK
        int     product_id  FK "nullable"
        int     admin_id    FK "nullable"
        text    action      "create | update | delete | activate | deactivate"
        text    changes     "JSON diff"
        datetime created_at
    }

    orders {
        int     id              PK
        text    order_number    UK
        text    customer_name
        text    customer_email
        text    customer_phone
        text    shipping_address
        text    notes
        text    status          "pending | paid | shipped | completed | cancelled"
        text    source          "marketplace | designer"
        real    subtotal
        real    discount        "знижка фотодруку"
        real    total           "subtotal - discount"
        text    idempotency_key "захист від дублів (частковий UNIQUE idx)"
        text    notify_status   "pending | sent | failed"
        text    tracking_number "ТТН Нова Пошта (при «Відправлено»)"
        text    cancel_reason   "причина скасування"
        text    archive_url     "ZIP фотокниги"
        text    archive_status  "pending | ready | failed"
        text    photo_delivery_status   "pending | sent — SFTP-доставка фото"
        datetime photo_delivery_at      "час доставки у сховище"
        int     photo_delivery_attempts "спроби (черга повторів)"
        datetime created_at
        datetime updated_at
    }

    order_items {
        int     id              PK
        int     order_id        FK
        int     product_id      FK "nullable — snapshot"
        int     variant_id      FK "nullable"
        int     design_id       FK "nullable"
        text    design_data     "JSON: fabric + print-URL + innerPhotos книги + book-мета"
        text    design_preview  "URL прев'ю (мокап/фото)"
        text    product_name    "snapshot назви"
        text    variant_label
        real    unit_price
        int     quantity
        real    line_total
        datetime created_at
    }

    service_categories {
        int     id          PK
        text    name
        int     sort_order
        int     is_active
        datetime created_at
        datetime updated_at
    }

    services {
        int     id          PK
        int     category_id FK
        text    code
        text    name
        text    format
        real    price
        real    price_insta
        int     sort_order
        int     is_active
        datetime created_at
        datetime updated_at
    }

    settings {
        text    key     PK
        text    value
        datetime updated_at
    }

    slides {
        int     id          PK
        text    image_url
        text    title
        text    subtitle
        text    link
        text    cta_label
        int     sort_order
        int     is_active
    }

    customers {
        int     id      PK
        text    name
        text    email   UK "nullable"
        text    phone
        text    notes
        text    source  "manual | marketplace | designer | import"
        datetime created_at
        datetime updated_at
    }

    backgrounds {
        int     id          PK
        text    image_url
        text    name
        int     sort_order
        int     is_active
        datetime created_at
        datetime updated_at
    }

    push_subscriptions {
        int     id          PK
        text    endpoint    UK
        text    p256dh      "ключ шифрування"
        text    auth        "auth-секрет"
        datetime created_at
    }
```

---

## Опис сутностей

| Сутність | Призначення |
|----------|-------------|
| **admins** | Адміністратори панелі; `permissions` — JSON-масив дозволів (NULL = superadmin) |
| **categories** | Категорії товарів; `parent_id` — самопосилання для ієрархії |
| **products** | Товари каталогу; `designer_type` → прив'язка до типу в конструкторі |
| **designs** | Збережені дизайни з конструктора (Fabric.js JSON + PNG прев'ю) |
| **product_images** | Галерея зображень товару (кілька на товар, `is_primary`) |
| **product_variants** | Варіанти товару (розмір/колір) з власним `price_modifier` і залишком |
| **product_audit_logs** | Журнал змін товарів адміністраторами |
| **orders** | Замовлення клієнтів; `source` — з сайту або з конструктора. Життєвий цикл: `idempotency_key` (захист від дублів, частковий UNIQUE), `notify_status` (web-push власнику), `tracking_number` (ТТН Нова Пошта), `cancel_reason`, `archive_url`/`archive_status` (ZIP фотокниги), `photo_delivery_*` (SFTP-доставка фото у сховище) |
| **order_items** | Позиції замовлення; `product_name` — snapshot, щоб не залежати від змін |
| **service_categories** | Категорії прайс-листа |
| **services** | Послуги прайс-листа (`code`+`format`→ціна; коди звʼязані з конструктором) |
| **settings** | Key-value: лічильники номерів (`order_seq_*`), SMTP, налаштування сайту (`site_contacts`/`site_delivery`/`site_discounts`/`site_hero`/`site_seo`), Telegram (`telegram`), SFTP-сховище фото (`sftp_storage`), авто-згенеровані VAPID-ключі Web-Push (`push_vapid_public`/`push_vapid_private`). Дефолти конфігу — у коді |
| **slides** | Слайди банера маркетплейсу (адмін-керовані) |
| **backgrounds** | Готові фони для фотоальбомів (адмін-керовані: завантаження/сортування/активність) |
| **push_subscriptions** | Web-Push підписки власника (по одній на пристрій); `endpoint` UK, `p256dh`/`auth` — ключі шифрування |
| **customers** | CRM: автозахоплення клієнтів із замовлень (за email/телефоном) |

---

## Зв'язки та FK-поведінка

| FK | Посилання | ON DELETE |
|----|-----------|-----------|
| `categories.parent_id` | `categories.id` | SET NULL |
| `products.category_id` | `categories.id` | RESTRICT |
| `products.design_id` | `designs.id` | — (nullable, без FK constraint) |
| `product_images.product_id` | `products.id` | CASCADE |
| `product_variants.product_id` | `products.id` | CASCADE |
| `product_audit_logs.product_id` | `products.id` | SET NULL |
| `product_audit_logs.admin_id` | `admins.id` | SET NULL |
| `order_items.order_id` | `orders.id` | CASCADE |
| `order_items.product_id` | `products.id` | SET NULL |
| `services.category_id` | `service_categories.id` | CASCADE |

---

## Поле `designer_type`

Пов'язує товар маркетплейсу з типом продукту в конструкторі:

| Значення | Тип продукту |
|----------|-------------|
| `crew-neck` | Футболка (перёд/зад, 2D + 3D) |
| `mug`, `mug-*` | Чашки (5 видів) |
| `polaroid`, `instax-mini`, `photo-*` | Фотопродукція (полароїди, Instax, фото 10×15…А4, квадрат) |
| `canvas` | Полотно на підрамнику |
| `slim-book`, `print-book` | Фотокниги (обкладинка перёд/зад + фото розворотів/листів) |

Товари з `designer_type IS NOT NULL` **не відображаються** у каталозі та **не видаляються** через API.

---

## Snapshot-патерн у замовленнях

`order_items.product_name` і `unit_price` зберігаються як snapshot на момент замовлення. Навіть якщо товар буде перейменований або ціна зміниться, дані замовлення залишаються незмінними. `product_id` nullable — якщо товар видалено, позиція замовлення залишається з `product_id = NULL` але зберігає всі дані.
