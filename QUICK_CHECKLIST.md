# ⚡ Quick Implementation Checklist

**Для быстрого старта интеграции админ-панели и конструктора**

---

## 🔧 Фаза 1: Backend (3-4 часа)

### Шаг 1: Обновить БД
- [ ] Открыть `marketplace/database/schema.sql`
- [ ] Добавить таблицу `designs` (см. INTEGRATION_GUIDE.md)
- [ ] Добавить поле `design_id` в таблицу `products`
- [ ] Создать индексы
- [ ] Протестировать: `sqlite3 marketplace/marketplace.db ".tables"`

### Шаг 2: Создать Designs API
- [ ] Создать `marketplace/server/src/routes/designs.js`
- [ ] Добавить 5 endpoints:
  - `GET /api/designs`
  - `GET /api/designs/:id`
  - `POST /api/designs`
  - `PUT /api/designs/:id`
  - `DELETE /api/designs/:id`
- [ ] Зарегистрировать route в `index.js`
- [ ] Протестировать: `curl http://localhost:3001/api/designs`

### Шаг 3: Обновить Products API
- [ ] Обновить `POST /api/products` для приема `design_id`
- [ ] Обновить `PUT /api/products/:id` для обновления `design_id`
- [ ] Проверить, что товар сохраняется с дизайном

### Проверка (Фаза 1):
```bash
# В Postman или curl:
POST http://localhost:3001/api/designs
{
  "name": "Test Design",
  "productType": "crew-neck",
  "fabricData": {"version": "5.3.0", "objects": []},
  "width": 500,
  "height": 600
}

# Должен вернуть: id, name, created_at, etc.
```

---

## 🎨 Фаза 2: Designer Integration (2-3 часа)

### Шаг 1: Создать DesignerModal Component
- [ ] Создать `marketplace/client/src/components/DesignerModal.jsx`
- [ ] Встроить DesignArea component
- [ ] Встроить TShirtModel component
- [ ] Добавить сохранение дизайна в БД
- [ ] Протестировать открытие/закрытие

### Шаг 2: Обновить API client
- [ ] Открыть `marketplace/client/src/lib/api.js`
- [ ] Добавить методы:
  - `getDesigns()`
  - `getDesign(id)`
  - `createDesign(data)`
  - `updateDesign(id, data)`
  - `deleteDesign(id)`

### Шаг 3: Обновить Product Form
- [ ] Открыть `marketplace/client/src/pages/admin/AdminProductFormPage.jsx`
- [ ] Импортировать DesignerModal
- [ ] Добавить кнопку "Создать дизайн"
- [ ] Добавить селект "Выбрать дизайн из шаблонов"
- [ ] Привязать выбранный дизайн к форме (`design_id`)
- [ ] Протестировать весь flow создания товара с дизайном

### Проверка (Фаза 2):
```
✓ Нажать кнопку "Создать дизайн" → открывается модал
✓ Нарисовать дизайн в canvas
✓ Нажать "Сохранить" → дизайн сохранен в БД
✓ При создании товара: дизайн выбирается
✓ При сохранении товара: design_id сохраняется
```

---

## 👨‍💼 Фаза 3: Admin UI (1-2 часа)

### Шаг 1: Создать Designs Management Page
- [ ] Создать `marketplace/client/src/pages/admin/AdminDesignsPage.jsx`
- [ ] Отобразить все дизайны в сетке
- [ ] Добавить preview изображение
- [ ] Добавить счетчик использований
- [ ] Добавить кнопку удаления

### Шаг 2: Обновить Navigation
- [ ] Открыть `marketplace/client/src/pages/admin/AdminLayout.jsx`
- [ ] Добавить ссылку на "Дизайни" в меню
- [ ] Импортировать Palette иконку

### Шаг 3: Добавить Route
- [ ] Открыть `marketplace/client/src/App.jsx`
- [ ] Импортировать AdminDesignsPage
- [ ] Добавить route: `<Route path="designs" element={<AdminDesignsPage />} />`

### Проверка (Фаза 3):
```
✓ Открыть http://localhost:5174/admin
✓ В меню должна быть ссылка "Дизайни"
✓ Нажать и перейти на страницу дизайнов
✓ Должны отобразиться созданные дизайны
✓ Кнопка удаления работает
```

---

## ✅ Финальная Проверка

### Полный flow:
```
1. Открыть http://localhost:5174/admin
2. Перейти на "Товари" → "Додати товар"
3. Заполнить основные поля (название, цена)
4. Нажать "Створити новий дизайн"
5. Рисовать дизайн в модальном окне
6. Сохранить дизайн ("Зберегти")
7. Дизайн появляется как выбранный
8. Нажать "Сохранить товар"
9. Товар создан с дизайном ✓

10. Перейти на "Дизайни"
11. Увидеть созданный дизайн
12. Может быть удален (если не используется)

13. Открыть товар для редактирования
14. Должен виден выбранный дизайн
15. Можно заменить на другой или удалить
```

---

## 🛠️ Полезные команды

### Development режим:
```bash
# Terminal 1 - Designer
cd t-shirt-designer-webapp-main
npm run dev

# Terminal 2 - API
cd marketplace/server
npm run dev

# Terminal 3 - Client
cd marketplace/client
npm run dev
```

### Тестирование API:
```bash
# Получить список дизайнов
curl http://localhost:3001/api/designs

# Создать дизайн
curl -X POST http://localhost:3001/api/designs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "productType": "crew-neck",
    "fabricData": {"objects": []},
    "width": 500,
    "height": 600
  }'

# Удалить дизайн
curl -X DELETE http://localhost:3001/api/designs/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Database проверки:
```bash
# Открыть SQLite shell
sqlite3 marketplace/marketplace.db

# Просмотреть таблицы
.tables

# Проверить структуру designs
PRAGMA table_info(designs);

# Просмотреть дизайны
SELECT id, name, product_type, created_at FROM designs;

# Выход
.quit
```

---

## ⏱️ Временная оценка

| Фаза | Компонент | Время | Статус |
|------|-----------|-------|--------|
| 1 | Database | 30 мин | ⬜ |
| 1 | Design API | 1 час | ⬜ |
| 1 | Products API update | 30 мин | ⬜ |
| 2 | DesignerModal | 1 час | ⬜ |
| 2 | Product Form integration | 1 час | ⬜ |
| 2 | API client | 30 мин | ⬜ |
| 3 | AdminDesignsPage | 1 час | ⬜ |
| 3 | Navigation | 15 мин | ⬜ |
| 3 | Routing | 15 мин | ⬜ |
| 4 | Testing | 1-2 час | ⬜ |
| **ВСЬОГО** | | **7-8 часов** | |

---

## 🐛 Возможные проблемы и решения

### Проблема: "Design not found" при создании товара
**Решение:** Проверить, что `design_id` правильно передается в API

### Проблема: Modal не открывается
**Решение:** Проверить импорты компонентов, убедиться что state правильно управляется

### Проблема: Дизайн не сохраняется в БД
**Решение:** Проверить:
- JSON структура fabricData
- JWT token валидный
- API endpoint работает (тестировать через curl)

### Проблема: 3D preview не работает в modal
**Решение:** Может требоваться пробросить контекст Three.js более аккуратно, либо создать mini версию компонента

---

## 📚 Дополнительные ресурсы

- **INTEGRATION_GUIDE.md** - Полное руководство с кодом
- **PROJECT_ANALYSIS.md** - Детальный анализ архитектуры
- **README.md** - Обзор технологий
- **Marketplace README** - Специфика маркетплейса

---

## 🎯 Следующие шаги после интеграции

1. **Улучшить UI компоненты админ-панели**
   - Select с поиском
   - Улучшенные textarea
   - Multi-select для категорий

2. **Добавить управление категориями в админку**
   - CRUD категорий
   - Привязка к товарам

3. **Реализовать управление вариантами**
   - Размеры, цвета
   - Цены для вариантов
   - Наличие на складе

4. **Улучшить маркетплейс UI**
   - Фильтры по типу товара
   - Фильтры по цене
   - Сортировка
   - Pagination

---

**Автор:** GitHub Copilot  
**Дата:** 2026-06-14  
**Версия:** 1.0
