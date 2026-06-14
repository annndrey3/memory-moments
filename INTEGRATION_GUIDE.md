# 🚀 Интеграция админ-панели и конструктора дизайна

**Статус:** 🚧 Руководство по интеграции  
**Дата:** 2026-06-14  

---

## 📋 Таблица содержания

1. [Обзор интеграции](#обзор-интеграции)
2. [Архитектура решения](#архитектура-решения)
3. [Фаза 1: Backend подготовка](#фаза-1-backend-подготовка)
4. [Фаза 2: Designer Integration](#фаза-2-designer-integration)
5. [Фаза 3: Admin Panel UI](#фаза-3-admin-panel-ui)
6. [Фаза 4: Тестирование](#фаза-4-тестирование)

---

## 🎯 Обзор интеграции

### Проблема
- ❌ Дизайны, созданные в конструкторе, не сохраняются в БД
- ❌ Админ-панель не может выбирать/сохранять дизайны товаров
- ❌ Нет связи между созданным дизайном и товаром
- ❌ Конструктор работает отдельно от маркетплейса

### Решение
- ✅ Расширить БД для хранения дизайнов (JSON)
- ✅ Добавить API endpoints для дизайнов
- ✅ Встроить конструктор в админ-панель
- ✅ Связать дизайны с товарами при создании

### Результат
- 📦 Администратор может создавать товары с дизайнами
- 🎨 Дизайны сохраняются в БД и переиспользуются
- 🔗 Каждый товар связан с его дизайном
- 📊 История дизайнов для отчетов

---

## 🏗️ Архитектура решения

### Текущая архитектура
```
┌─────────────────────────────────────────┐
│    T-Shirt Designer (отдельный)         │
│    - 2D Canvas                          │
│    - 3D Preview                         │
│    - LocalStorage (БЕЗ БД)              │
└─────────────────────────────────────────┘
           ↓↑ (ОТСУТСТВУЕТ)
┌─────────────────────────────────────────┐
│    Marketplace Admin Panel              │
│    - Product CRUD                       │
│    - Image Management                   │
│    - БЕЗ дизайнов                       │
└─────────────────────────────────────────┘
```

### Целевая архитектура
```
┌──────────────────────────────────────────────────────┐
│           Marketplace Admin Panel                     │
├──────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────┐  │
│  │  Designer Component (встроен в админку)       │  │
│  │  - 2D Canvas                                  │  │
│  │  - 3D Preview                                 │  │
│  │  - Save to DB                                 │  │
│  └────────────────────────────────────────────────┘  │
│                      ↓                                │
│  ┌────────────────────────────────────────────────┐  │
│  │  Product Form + Design Selector               │  │
│  │  - Выбор существующего дизайна               │  │
│  │  - Создание нового дизайна                    │  │
│  │  - Привязка к товару                          │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
           ↓↑ (НОВОЕ API)
┌──────────────────────────────────────────────────────┐
│           Backend API                                │
├──────────────────────────────────────────────────────┤
│  GET  /api/designs             - Список дизайнов    │
│  POST /api/designs             - Создать дизайн     │
│  PUT  /api/designs/:id         - Обновить дизайн    │
│  GET  /api/designs/:id         - Деталь дизайна     │
│  DELETE /api/designs/:id       - Удалить дизайн     │
│                                                      │
│  Updated:                                            │
│  POST /api/products            - with design_id     │
│  PUT  /api/products/:id        - with design_id     │
└──────────────────────────────────────────────────────┘
           ↓↑
┌──────────────────────────────────────────────────────┐
│           SQLite Database                            │
├──────────────────────────────────────────────────────┤
│  products                                            │
│    - design_id (FK to designs)                       │
│    - ...existing fields...                           │
│                                                      │
│  designs (NEW TABLE)                                 │
│    - id                                              │
│    - name                                            │
│    - fabric_data (JSON)         ← Canvas objects    │
│    - preview_image              ← 3D render         │
│    - product_count                                   │
│    - created_at, updated_at                          │
└──────────────────────────────────────────────────────┘
```

---

## 🔧 Фаза 1: Backend подготовка

### Шаг 1.1: Расширить Schema БД

**Файл:** `marketplace/database/schema.sql`

```sql
-- Новая таблица для сохранения дизайнов
CREATE TABLE designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  product_type TEXT NOT NULL, -- 'crew-neck', 'mug', 'polaroid', etc
  fabric_data JSON NOT NULL,   -- Fabric.js canvas objects
  preview_image TEXT,           -- Base64 or URL to 3D render
  thumbnail TEXT,               -- Small preview
  
  -- Metadata
  width INTEGER,                -- Canvas width
  height INTEGER,               -- Canvas height
  is_template BOOLEAN DEFAULT 0, -- Может ли использоваться как шаблон
  is_public BOOLEAN DEFAULT 0,   -- Видна ли в галереи
  usage_count INTEGER DEFAULT 0, -- Сколько раз используется
  
  -- Relations
  created_by INTEGER,           -- User ID (когда будет auth)
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Добавить в таблицу products
ALTER TABLE products ADD COLUMN design_id INTEGER;
ALTER TABLE products ADD FOREIGN KEY (design_id) REFERENCES designs(id) ON DELETE SET NULL;

-- Индексы для оптимизации
CREATE INDEX idx_designs_product_type ON designs(product_type);
CREATE INDEX idx_designs_created_at ON designs(created_at);
CREATE INDEX idx_products_design_id ON products(design_id);
```

### Шаг 1.2: Добавить API endpoints

**Файл:** `marketplace/server/src/routes/designs.js` (НОВЫЙ файл)

```javascript
import express from "express";
import { db } from "../config/database.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/designs - Список всех дизайнов
router.get("/", (req, res) => {
  try {
    const { productType, limit = 50, offset = 0 } = req.query;
    
    let query = "SELECT * FROM designs";
    const params = [];
    
    if (productType) {
      query += " WHERE product_type = ?";
      params.push(productType);
    }
    
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const designs = db.prepare(query).all(...params);
    res.json({ items: designs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch designs" });
  }
});

// GET /api/designs/:id - Деталь дизайна
router.get("/:id", (req, res) => {
  try {
    const design = db.prepare("SELECT * FROM designs WHERE id = ?").get(req.params.id);
    if (!design) return res.status(404).json({ error: "Design not found" });
    
    res.json(design);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch design" });
  }
});

// POST /api/designs - Создать дизайн (auth required)
router.post("/", auth, (req, res) => {
  try {
    const { name, description, productType, fabricData, previewImage, width, height } = req.body;
    
    if (!name || !productType || !fabricData) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const stmt = db.prepare(`
      INSERT INTO designs (name, description, product_type, fabric_data, preview_image, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, description, productType, JSON.stringify(fabricData), previewImage, width, height);
    
    const design = db.prepare("SELECT * FROM designs WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(design);
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Design with this name already exists" });
    }
    res.status(500).json({ error: "Failed to create design" });
  }
});

// PUT /api/designs/:id - Обновить дизайн (auth required)
router.put("/:id", auth, (req, res) => {
  try {
    const design = db.prepare("SELECT * FROM designs WHERE id = ?").get(req.params.id);
    if (!design) return res.status(404).json({ error: "Design not found" });
    
    const { name, description, fabricData, previewImage } = req.body;
    
    const stmt = db.prepare(`
      UPDATE designs 
      SET name = ?, description = ?, fabric_data = ?, preview_image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(name || design.name, description || design.description, JSON.stringify(fabricData) || design.fabric_data, previewImage || design.preview_image, req.params.id);
    
    const updated = db.prepare("SELECT * FROM designs WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update design" });
  }
});

// DELETE /api/designs/:id - Удалить дизайн (auth required)
router.delete("/:id", auth, (req, res) => {
  try {
    const design = db.prepare("SELECT * FROM designs WHERE id = ?").get(req.params.id);
    if (!design) return res.status(404).json({ error: "Design not found" });
    
    // Проверить, используется ли дизайн
    const usage = db.prepare("SELECT COUNT(*) as count FROM products WHERE design_id = ?").get(req.params.id);
    if (usage.count > 0) {
      return res.status(400).json({ error: "Design is used by products" });
    }
    
    db.prepare("DELETE FROM designs WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete design" });
  }
});

export default router;
```

### Шаг 1.3: Зарегистрировать route в `index.js`

**Файл:** `marketplace/server/src/index.js`

```javascript
import designsRouter from "./routes/designs.js";

// ... другие routes ...

app.use("/api/designs", designsRouter);
```

### Шаг 1.4: Обновить Product API

**Файл:** `marketplace/server/src/routes/products.js`

```javascript
// В createProduct
const { design_id, ...productData } = req.body;
const result = stmt.run(...values, design_id); // Добавить design_id

// В updateProduct
const updateStmt = db.prepare(`
  UPDATE products 
  SET name = ?, ..., design_id = ?
  WHERE id = ?
`);
updateStmt.run(...values, design_id, productId);
```

---

## 🎨 Фаза 2: Designer Integration

### Шаг 2.1: Создать Designer Component для Админки

**Файл:** `marketplace/client/src/components/DesignerModal.jsx` (НОВЫЙ)

```jsx
import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { api } from "@/lib/api";

// Встроить конструктор здесь
import DesignArea from "../../../t-shirt-designer-webapp-main/src/components/DesignArea";
import TShirtModel from "../../../t-shirt-designer-webapp-main/src/components/TShirtModel";

export default function DesignerModal({ productType = "crew-neck", onSave, onClose }) {
  const [designName, setDesignName] = useState("");
  const [saving, setSaving] = useState(false);
  const [canvas, setCanvas] = useState(null);

  const handleSave = async () => {
    if (!designName || !canvas) {
      alert("Please enter design name");
      return;
    }

    setSaving(true);
    try {
      const fabricData = canvas.toJSON();
      const previewImage = canvas.toDataURL();

      const design = await api.createDesign({
        name: designName,
        description: `${productType} design`,
        productType,
        fabricData,
        previewImage,
        width: canvas.width,
        height: canvas.height,
      });

      onSave(design);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-screen overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Дизайнер товара</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-2 gap-6">
          {/* Designer */}
          <div>
            <h3 className="font-semibold mb-3">2D Редактор</h3>
            <div className="border rounded-lg p-4 bg-slate-50">
              <DesignArea onCanvasReady={setCanvas} productType={productType} />
            </div>
          </div>

          {/* Preview + Settings */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">3D Превью</h3>
              <div className="border rounded-lg p-4 bg-slate-50 h-64">
                <TShirtModel canvas={canvas} productType={productType} />
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Сохранить дизайн</h3>
              <Input
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                placeholder="Название дизайна"
                className="mb-3 rounded-xl"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={saving || !designName}
                  className="flex-1 rounded-xl"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Сохраняется..." : "Сохранить"}
                </Button>
                <Button variant="outline" onClick={onClose} className="rounded-xl">
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Шаг 2.2: Добавить Design Selector в Product Form

**Файл:** `marketplace/client/src/pages/admin/AdminProductFormPage.jsx` (ОБНОВИТЬ)

```jsx
import DesignerModal from "../../components/DesignerModal";

export default function AdminProductFormPage() {
  const [showDesigner, setShowDesigner] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [designs, setDesigns] = useState([]);
  
  // ... existing code ...

  // Загрузить дизайны
  useEffect(() => {
    api.getDesigns({ productType: form.designer_type })
      .then(setDesigns)
      .catch(console.error);
  }, [form.designer_type]);

  const handleSaveDesign = (design) => {
    setSelectedDesign(design);
    setForm({ ...form, design_id: design.id });
  };

  return (
    <div>
      {/* ... existing form fields ... */}

      {/* Design Section */}
      <div className="border rounded-xl p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">Дизайн товара</h3>
        
        {selectedDesign ? (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium">{selectedDesign.name}</p>
              <p className="text-sm text-slate-500">{selectedDesign.product_type}</p>
            </div>
            <button
              onClick={() => {
                setSelectedDesign(null);
                setForm({ ...form, design_id: null });
              }}
              className="text-red-500 text-sm"
            >
              Удалить
            </button>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => setShowDesigner(true)}
            variant="outline"
            className="rounded-xl"
          >
            Создать новый дизайн
          </Button>

          {designs.length > 0 && (
            <select
              onChange={(e) => {
                const design = designs.find((d) => d.id === parseInt(e.target.value));
                if (design) handleSaveDesign(design);
              }}
              className="rounded-xl border p-2"
            >
              <option>Выбрать из шаблонов...</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Designer Modal */}
      {showDesigner && (
        <DesignerModal
          productType={form.designer_type || "crew-neck"}
          onSave={handleSaveDesign}
          onClose={() => setShowDesigner(false)}
        />
      )}

      {/* ... save button ... */}
    </div>
  );
}
```

### Шаг 2.3: Обновить API client

**Файл:** `marketplace/client/src/lib/api.js` (ДОБАВИТЬ)

```javascript
export const api = {
  // ... existing methods ...

  // Designs
  getDesigns: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/designs?${qs}`);
  },

  getDesign: (id) => request(`/designs/${id}`),

  createDesign: (data) =>
    request("/designs", { method: "POST", body: JSON.stringify(data) }),

  updateDesign: (id, data) =>
    request(`/designs/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteDesign: (id) =>
    request(`/designs/${id}`, { method: "DELETE" }),
};
```

---

## 🎨 Фаза 3: Admin Panel UI

### Шаг 3.1: Добавить Page для управления Дизайнами

**Файл:** `marketplace/client/src/pages/admin/AdminDesignsPage.jsx` (НОВЫЙ)

```jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { api } from "@/lib/api";

export default function AdminDesignsPage() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.getDesigns({ limit: 100 })
      .then(d => setDesigns(d.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Видалити дизайн "${name}"?`)) return;
    try {
      await api.deleteDesign(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Дизайни</h2>
          <p className="text-sm text-slate-500">{designs.length} позицій</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            Завантаження...
          </div>
        ) : designs.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            Дизайнів немає
          </div>
        ) : (
          designs.map((d) => (
            <div key={d.id} className="border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow">
              {d.preview_image ? (
                <img src={d.preview_image} alt="" className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-slate-100" />
              )}
              <div className="p-4">
                <h3 className="font-medium mb-1">{d.name}</h3>
                <div className="flex items-center justify-between mb-3">
                  <Badge>{d.product_type}</Badge>
                  <span className="text-xs text-slate-500">{d.usage_count} uses</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="flex-1 rounded-lg">
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 rounded-lg text-red-500"
                    onClick={() => handleDelete(d.id, d.name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

### Шаг 3.2: Добавить в AdminLayout

**Файл:** `marketplace/client/src/pages/admin/AdminLayout.jsx` (ОБНОВИТЬ)

```jsx
<nav className="flex-1 p-3 space-y-1">
  <Link to="/admin/products" className="...">
    <Package className="h-4 w-4" />
    Товари
  </Link>
  
  <Link to="/admin/designs" className="...">
    <Palette className="h-4 w-4" />
    Дизайни
  </Link>
  
  {/* ... other links ... */}
</nav>
```

### Шаг 3.3: Добавить Route

**Файл:** `marketplace/client/src/App.jsx` (ОБНОВИТЬ)

```jsx
import AdminDesignsPage from "./pages/admin/AdminDesignsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... existing routes ... */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/products" replace />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/new" element={<AdminProductFormPage />} />
          <Route path="products/:id" element={<AdminProductFormPage />} />
          <Route path="designs" element={<AdminDesignsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

---

## ✅ Фаза 4: Тестирование

### Чек-лист тестирования

- [ ] **API endpoints работают**
  - [ ] `GET /api/designs` возвращает список
  - [ ] `POST /api/designs` создает дизайн
  - [ ] `PUT /api/designs/:id` обновляет дизайн
  - [ ] `DELETE /api/designs/:id` удаляет дизайн

- [ ] **Designer Modal работает**
  - [ ] Открывается при нажатии "Создать дизайн"
  - [ ] Canvas и 3D preview синхронизированы
  - [ ] Можно сохранить дизайн
  - [ ] Дизайн сохраняется в БД

- [ ] **Product Form интеграция**
  - [ ] Список дизайнов загружается
  - [ ] Можно выбрать дизайн из шаблонов
  - [ ] Выбранный дизайн отображается
  - [ ] При сохранении товара дизайн привязывается

- [ ] **Admin Designs Page**
  - [ ] Отображает все дизайны
  - [ ] Можно удалить дизайн
  - [ ] Показывает превью
  - [ ] Фильтрация по типу работает

---

## 📊 Таблица реализации

| Компонент | Статус | Время | Приоритет |
|-----------|--------|-------|-----------|
| DB Schema | ⬜ | 30 мин | 🔴 HIGH |
| Design API | ⬜ | 1 час | 🔴 HIGH |
| Designer Modal | ⬜ | 2 часа | 🔴 HIGH |
| Product Form Integration | ⬜ | 1 час | 🔴 HIGH |
| Admin Designs Page | ⬜ | 1 час | 🟡 MED |
| UI Polish | ⬜ | 1 час | 🟡 MED |
| Testing | ⬜ | 1 час | 🟡 MED |
| **ВСЬОГО** | | **7 часов** | |

---

## 🎯 Следующие шаги

1. **Неделя 1:** Реализовать все фазы 1-3
2. **Неделя 2:** Тестирование и баг-фиксы
3. **Неделя 3:** Улучшение UI/UX админ-панели

---

## 💡 Дополнительные идеи

### Будущие улучшения
- [ ] Дизайн-галерея (public templates)
- [ ] Совместное редактирование дизайнов
- [ ] Версионирование дизайнов
- [ ] Export дизайна (файлы для печати)
- [ ] Design analytics (популярные дизайны)
- [ ] Интеграция с AI для автогенерации дизайнов

---

*Документ сгенерирован: GitHub Copilot | 2026-06-14*
