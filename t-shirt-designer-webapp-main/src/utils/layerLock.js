// «Керувати можна лише активним шаром»: на макеті рухати/трансформувати дозволено
// тільки вибраному обʼєкту. Решту тимчасово блокуємо (evented/selectable=false), щоб
// при перекритті не хапати чужий обʼєкт — потрібний шар обирають кліком або в панелі
// «Шари». Не персиститься (toJSON не серіалізує ці поля).
function inActiveSelection(active, o) {
  return active && active.type === "activeselection" && active._objects?.includes(o);
}

export function lockToActive(canvas) {
  if (!canvas?.getObjects) return;
  const active = canvas.getActiveObject();
  canvas.getObjects().forEach((o) => {
    if (o.mmRole === "background") return; // фон завжди заблокований (керується кнопкою «Фон»)
    const on = !active || o === active || inActiveSelection(active, o);
    o.selectable = on;
    o.evented = on;
  });
}

export function unlockAll(canvas) {
  if (!canvas?.getObjects) return;
  canvas.getObjects().forEach((o) => {
    if (o.mmRole === "background") return;
    o.selectable = true;
    o.evented = true;
  });
}
