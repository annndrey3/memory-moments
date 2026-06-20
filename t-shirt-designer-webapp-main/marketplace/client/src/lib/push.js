// Клієнтська частина web-push: реєстрація service worker + підписка/відписка.
import { api } from "./api";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushState() {
  if (!pushSupported()) return { supported: false, subscribed: false, permission: "unsupported" };
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    subscribed = !!sub;
  } catch { /* ignore */ }
  return { supported: true, subscribed, permission: Notification.permission };
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("Цей браузер не підтримує пуш-сповіщення.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Дозвіл на сповіщення не надано. Дозвольте їх у налаштуваннях браузера.");
  const reg = await navigator.serviceWorker.register("/push-sw.js");
  await navigator.serviceWorker.ready;
  const { key } = await api.getVapidKey();
  if (!key) throw new Error("Сервер не повернув ключ. Спробуйте пізніше.");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
  }
  await api.pushSubscribe(sub);
  return true;
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await api.pushUnsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* ignore */ }
  return true;
}
