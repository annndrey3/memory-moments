# ER-модель маркетплейсу Memory Moments

## Діаграма сутностей

```mermaid
erDiagram
    admins ||--o{ product_audit_logs : creates
    categories ||--o{ products : contains
    products ||--o{ product_images : has
    products ||--o{ product_variants : has

    admins {
        int id PK
        varchar email UK
        varchar password_hash
        varchar name
        enum role
        datetime created_at
        datetime updated_at
    }

    categories {
        int id PK
        varchar name
        varchar slug UK
        text description
        int parent_id FK
        int sort_order
        tinyint is_active
        datetime created_at
        datetime updated_at
    }

    products {
        int id PK
        int category_id FK
        varchar name
        varchar slug UK
        text short_description
        text description
        decimal price
        decimal compare_at_price
        varchar sku UK
        int stock_quantity
        varchar designer_type
        tinyint is_active
        tinyint is_featured
        datetime created_at
        datetime updated_at
    }

    product_images {
        int id PK
        int product_id FK
        varchar image_url
        varchar alt_text
        int sort_order
        tinyint is_primary
        datetime created_at
    }

    product_variants {
        int id PK
        int product_id FK
        varchar attribute_name
        varchar attribute_value
        decimal price_modifier
        int stock_quantity
        varchar sku UK
        datetime created_at
        datetime updated_at
    }

    product_audit_logs {
        int id PK
        int product_id FK
        int admin_id FK
        enum action
        json changes
        datetime created_at
    }
```

## Опис сутностей

| Сутність | Призначення |
|----------|-------------|
| **admins** | Адміністратори з доступом до панелі керування |
| **categories** | Категорії товарів (ієрархічні через `parent_id`) |
| **products** | Картки товарів маркетплейсу |
| **product_images** | Галерея зображень товару |
| **product_variants** | Варіанти (колір, розмір) з окремим залишком |
| **product_audit_logs** | Журнал змін товарів адміністратором |

## Зв'язки

- `categories.parent_id` → `categories.id` (self-reference, nullable)
- `products.category_id` → `categories.id` (RESTRICT)
- `product_images.product_id` → `products.id` (CASCADE)
- `product_variants.product_id` → `products.id` (CASCADE)
- `product_audit_logs.product_id` → `products.id` (SET NULL)
- `product_audit_logs.admin_id` → `admins.id` (SET NULL)

## Поле `designer_type`

Зв'язує товар маркетплейсу з типом продукту в конструкторі (`crew-neck`, `mug`, `polaroid` тощо), щоб кнопка «Створити дизайн» відкривала потрібний шаблон.

## Індекси

- `products(is_active, is_featured)` — вітрина маркетплейсу
- `products(category_id)` — фільтр по категорії
- `product_images(product_id, is_primary)` — головне фото
- `categories(slug)` — SEO URL
