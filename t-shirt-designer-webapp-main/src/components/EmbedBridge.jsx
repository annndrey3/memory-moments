import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useCanvas } from "@/hooks/useCanvas";
import { setSelectedType } from "@/features/tshirtSlice";
import { PRODUCT_TYPES } from "@/constants/designConstants";

/**
 * EmbedBridge — мост між конструктором та маркетплейсом/адмінкою.
 *
 * Два режими роботи:
 *   1. embed (всередині <iframe> адмінки, ?embed=1):
 *        parent → designer:  { source: "mm-admin", type: "load",   fabricData }
 *        parent → designer:  { source: "mm-admin", type: "export" }
 *        designer → parent:  { source: "mm-designer", type: "ready" }
 *        designer → parent:  { source: "mm-designer", type: "design", payload: { fabricData, previewImage, productType } }
 *   2. standalone з ?designId=N (клієнт відкриває товар з готовим дизайном):
 *        конструктор сам тягне дизайн з API і завантажує його на полотно.
 *
 * Компонент нічого не рендерить — лише слухає/надсилає повідомлення.
 */
const API_BASE = import.meta.env.VITE_MARKETPLACE_API || "http://localhost:3001/api";

// Лише цим origin'ам дозволено вбудовувати конструктор і обмінюватися postMessage.
// Захищає від сторонніх сайтів, що вставили б конструктор в iframe, щоб
// керувати ним або викрасти експортований дизайн. Налаштовується через .env.
const ALLOWED_PARENT_ORIGINS = (
  import.meta.env.VITE_ALLOWED_PARENT_ORIGINS || "http://localhost:5174,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    embed: params.get("embed") === "1",
    type: params.get("type"),
    designId: params.get("designId"),
  };
}

export default function EmbedBridge() {
  const dispatch = useDispatch();
  const { frontCanvas } = useCanvas();
  // fabric-дані, що чекають на готовність полотна
  const pendingFabricRef = useRef(null);
  const paramsRef = useRef(readParams());

  // Завантажити fabric JSON на переднє полотно, зберігши clipPath (зону друку).
  const loadFabricData = (data) => {
    const canvas = frontCanvas;
    if (!canvas) {
      pendingFabricRef.current = data; // застосуємо, коли полотно з'явиться
      return;
    }
    try {
      const clip = canvas.clipPath;
      canvas.loadFromJSON(data).then(() => {
        canvas.clipPath = clip;
        canvas.renderAll();
      });
    } catch (err) {
      console.error("EmbedBridge: не вдалося завантажити дизайн", err);
    }
  };

  const exportDesign = () => {
    const canvas = frontCanvas;
    if (!canvas) return null;
    return {
      fabricData: canvas.toJSON(),
      previewImage: canvas.toDataURL({ format: "png", multiplier: 0.5 }),
      productType: canvas.productId || paramsRef.current.type || null,
    };
  };

  // targetOrigin обов'язковий — ніколи не шлемо "*", щоб дизайн не витік на чужий сайт.
  const postToParent = (message, targetOrigin) => {
    if (window.parent && window.parent !== window && targetOrigin) {
      window.parent.postMessage({ source: "mm-designer", ...message }, targetOrigin);
    }
  };

  // Прийом повідомлень від адмінки + сигнал готовності.
  useEffect(() => {
    const { embed, type } = paramsRef.current;

    if (type && PRODUCT_TYPES[type]) {
      dispatch(setSelectedType(type));
    }

    if (!embed) return;

    document.body.classList.add("mm-embed");

    const onMessage = (event) => {
      // Приймаємо команди лише від дозволених origin'ів адмінки/маркетплейсу.
      if (!ALLOWED_PARENT_ORIGINS.includes(event.origin)) return;
      const data = event.data;
      if (!data || data.source !== "mm-admin") return;

      if (data.type === "load" && data.fabricData) {
        loadFabricData(data.fabricData);
      } else if (data.type === "export") {
        const payload = exportDesign();
        // Відповідаємо рівно тому origin'у, що попросив експорт (вже перевірений вище).
        if (payload) postToParent({ type: "design", payload }, event.origin);
      }
    };

    window.addEventListener("message", onMessage);
    // Сигнал готовності — лише дозволеним батьківським origin'ам.
    ALLOWED_PARENT_ORIGINS.forEach((origin) => postToParent({ type: "ready" }, origin));

    return () => {
      window.removeEventListener("message", onMessage);
      document.body.classList.remove("mm-embed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Коли переднє полотно змонтувалося — застосувати відкладені дані
  // або підвантажити дизайн за designId (standalone-режим клієнта).
  useEffect(() => {
    if (!frontCanvas) return;

    if (pendingFabricRef.current) {
      loadFabricData(pendingFabricRef.current);
      pendingFabricRef.current = null;
      return;
    }

    const { designId } = paramsRef.current;
    if (designId) {
      fetch(`${API_BASE}/designs/${designId}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then((design) => {
          if (design?.fabric_data) loadFabricData(design.fabric_data);
        })
        .catch((err) => console.error("EmbedBridge: не вдалося завантажити дизайн з API", err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontCanvas]);

  return null;
}
