USE memory_moments_marketplace;

-- Default admin: admin@memory-moments.local / admin123
-- Password hash generated with bcrypt (10 rounds)
INSERT INTO admins (email, password_hash, name, role) VALUES
('admin@memory-moments.local', '$2b$10$bCf89d.88IQJ0GVA3o6VUOIEJs0yKALw7ItbfKa0C3I5kzZrac6QS', 'Адміністратор', 'superadmin');

INSERT INTO categories (name, slug, description, sort_order) VALUES
('Одяг', 'odyag', 'Футболки та текстиль', 1),
('Посуд', 'posud', 'Чашки та аксесуари', 2),
('Фотоформати', 'fotoformaty', 'Друк фото різних форматів', 3),
('Подарунки', 'podarunky', 'Готові ідеї для подарунків', 4);

INSERT INTO products (category_id, name, slug, short_description, description, price, compare_at_price, sku, stock_quantity, designer_type, is_active, is_featured) VALUES
(1, 'Футболка Premium', 'futbolka-premium',
 'Бавовняна футболка з можливістю друку',
 'Якісна бавовняна футболка 180 г/м². Друк DTG високої якості. Передня та задня сторона.',
 599.00, 749.00, 'TSH-PREM-001', 100, 'crew-neck', 1, 1),
(2, 'Чашка керамічна', 'chashka-keramichna',
 'Білa чашка 330 мл з повнокольоровим друком',
 'Керамічна чашка з друком навколо. Можна створити унікальний дизайн у конструкторі.',
 349.00, NULL, 'MUG-CER-001', 50, 'mug', 1, 1),
(3, 'Фото 10×15', 'foto-10x15',
 'Класичний портретний формат',
 'Друк фото 10×15 см на преміум папері.',
 29.00, NULL, 'PHO-10X15', 999, 'photo-10x15', 1, 0),
(3, 'Полароїд', 'polaroid',
 'Стиль фото Polaroid з підписом',
 'Друк у форматі полароїд з білим полем для підпису.',
 49.00, 59.00, 'PHO-POLAR', 200, 'polaroid', 1, 1),
(4, 'Instax Mini', 'instax-mini',
 'Формат миттєвого фото',
 'Друк у стилі Instax Mini — ідеальний подарунок.',
 59.00, NULL, 'PHO-INSTAX', 150, 'instax-mini', 1, 0);

INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary) VALUES
(1, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80', 'Футболка Premium', 0, 1),
(2, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80', 'Чашка керамічна', 0, 1),
(3, 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80', 'Фото 10x15', 0, 1),
(4, 'https://images.unsplash.com/photo-1493863641943-9b67165f6163?w=600&q=80', 'Полароїд', 0, 1),
(5, 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=600&q=80', 'Instax Mini', 0, 1);

INSERT INTO product_variants (product_id, attribute_name, attribute_value, price_modifier, stock_quantity, sku) VALUES
(1, 'size', 'S', 0.00, 25, 'TSH-PREM-S'),
(1, 'size', 'M', 0.00, 30, 'TSH-PREM-M'),
(1, 'size', 'L', 0.00, 25, 'TSH-PREM-L'),
(1, 'size', 'XL', 50.00, 20, 'TSH-PREM-XL'),
(2, 'color', 'Білий', 0.00, 30, 'MUG-WHT'),
(2, 'color', 'Чорний', 30.00, 20, 'MUG-BLK');
