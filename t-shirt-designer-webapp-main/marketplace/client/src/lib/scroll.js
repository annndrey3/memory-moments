// Плавна прокрутка до секції каталогу (#catalog). Поважає prefers-reduced-motion
// (тоді миттєво) і scroll-margin-top цілі (щоб заголовок не ховався під хедером).
export function scrollToCatalog() {
  const el = document.getElementById("catalog");
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
