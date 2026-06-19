// Єдине джерело контактів сайту. Заповніть реальними значеннями.
export const CONTACTS = {
  phone: "+38(068) 555-05-64", // телефон для дзвінків
  instagram: "memory_moments.od.ua", // нік Instagram (без @)
  telegram: "memory_moments_chern12", // нік Telegram (без @) АБО номер у форматі +380...
  viber: "+38(068) 555-05-64", // номер Viber (зазвичай той самий, що телефон)
  address: "вул. Артура Савельєва, 12, м. Одеса", // фізична адреса (текст)
  mapsUrl: "https://maps.app.goo.gl/DHby2xSEnGdzn1gZA", // точне посилання на карту
  // Філіали з посиланнями на Google Maps (показуються у футері).
  branches: [
    { address: "просп. Князя Ярослава Мудрого, 14/4, Одеса", mapsUrl: "https://maps.app.goo.gl/By3bwyX4DNDwsuqBA" },
    { address: "вул. Академіка Корольова, 70/1, Одеса", mapsUrl: "https://share.google/0TE04wraWVbbZsvTR" },
    { address: "вул. Преображенська, 48, Одеса", mapsUrl: "https://maps.app.goo.gl/g8moWYVnz2aUyCTt8" },
    { address: "вул. Артура Савельєва, 12, Одеса", mapsUrl: "https://maps.app.goo.gl/DHby2xSEnGdzn1gZA" },
  ],
  // Години роботи
  hours: [
    { days: "Пн–Пт", time: "09:00–19:00" },
    { days: "Сб–Нд", time: "10:00–18:00" },
  ],
};

const digits = (s) => (s || "").replace(/[^\d+]/g, "");

// Будує клікабельні посилання, що відкривають дзвінок/застосунок/чат напряму.
export function contactLinks() {
  const tg = (CONTACTS.telegram || "").trim();
  const telegramHref = tg.startsWith("+")
    ? `https://t.me/${tg}` // t.me/+380... теж відкриває чат
    : `https://t.me/${tg.replace(/^@/, "")}`;
  return {
    phone: `tel:${digits(CONTACTS.phone)}`,
    instagram: `https://instagram.com/${(CONTACTS.instagram || "").replace(/^@/, "")}`,
    telegram: telegramHref,
    viber: `viber://chat?number=${encodeURIComponent(digits(CONTACTS.viber))}`,
    maps:
      CONTACTS.mapsUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACTS.address || "")}`,
  };
}
