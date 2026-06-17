// Плавна прокрутка до елемента за id. Поважає prefers-reduced-motion (тоді
// миттєво). block: "start" (за замовч.) або "end" (для футера — до низу).
export function scrollToId(id, block = "start") {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block });
}

export function scrollToCatalog() {
  scrollToId("catalog");
}
