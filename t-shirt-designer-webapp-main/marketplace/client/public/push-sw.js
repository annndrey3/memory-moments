/* Service worker для web-push сповіщень адмінки Memory Moments.
   Показує сповіщення навіть коли вкладку/браузер закрито. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const title = data.title || "Memory Moments";
  const options = {
    body: data.body || "",
    icon: "/favicon-192.png",
    badge: "/favicon-192.png",
    tag: data.tag || "mm-order",
    renotify: true,
    data: { url: data.url || "/admin/orders" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/orders";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cls) => {
      for (const c of cls) {
        if (c.url.includes("/admin") && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
