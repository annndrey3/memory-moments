import * as fabric from "fabric";
import { useCallback, useEffect, useRef, useState } from "react";
import { unlockAll } from "@/utils/layerLock";

// Історія для кнопки «Скасувати» (undo) у конструкторі.
//
// Знімок = масив об'єктів активного полотна (canvas.getObjects().map(toObject)).
// Окрім стандартних полів серіалізуємо службові прапорці: блокування рамки/фону
// (selectable/evented/…), ролі (mmRole/mmSlot/mmFrameId) — щоб після відкату
// рамки лишалися заблокованими, а підписи полароїда — впізнаваними.
//
// clipPath полотна (зона друку) НЕ чіпаємо — він керується окремо в useTshirtCanvas;
// відкочуємо лише вміст (об'єкти).
const SNAP_PROPS = [
  "selectable",
  "evented",
  "hoverCursor",
  "objectCaching",
  "strokeUniform",
  "excludeFromExport",
  "mmRole",
  "mmSlot",
  "mmFrameId",
];
const MAX_STEPS = 40;

export function useCanvasHistory({ activeCanvas, manualSync }) {
  const pastRef = useRef([]); // знімки; останній елемент = поточний стан
  const restoringRef = useRef(false); // true під час відкату — не записуємо зміни
  const timerRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);

  const snapshot = useCallback((canvas) => {
    try {
      return JSON.stringify(canvas.getObjects().map((o) => o.toObject(SNAP_PROPS)));
    } catch {
      return null;
    }
  }, []);

  // Підписка на зміни активного полотна. Запис — з debounce, щоб програмні серії
  // (колаж із кількох комірок, застосування рамки) лягали одним кроком undo.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pastRef.current = [];
    setCanUndo(false);

    const canvas = activeCanvas;
    if (!canvas) return;

    const base = snapshot(canvas);
    if (base != null) pastRef.current = [base];

    const record = () => {
      if (restoringRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (restoringRef.current) return;
        const snap = snapshot(canvas);
        if (snap == null) return;
        const stack = pastRef.current;
        if (stack[stack.length - 1] === snap) return; // без фактичних змін
        stack.push(snap);
        if (stack.length > MAX_STEPS) stack.shift();
        setCanUndo(stack.length > 1);
      }, 200);
    };

    canvas.on("object:added", record);
    canvas.on("object:modified", record);
    canvas.on("object:removed", record);

    return () => {
      canvas.off("object:added", record);
      canvas.off("object:modified", record);
      canvas.off("object:removed", record);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeCanvas, snapshot]);

  const undo = useCallback(async () => {
    const canvas = activeCanvas;
    const stack = pastRef.current;
    if (!canvas || stack.length < 2) return;

    // Скасовуємо незаписаний крок, що чекає в debounce.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    stack.pop(); // прибираємо поточний стан
    const target = stack[stack.length - 1];
    setCanUndo(stack.length > 1);

    restoringRef.current = true;
    try {
      canvas.discardActiveObject();
      canvas.getObjects().slice().forEach((o) => canvas.remove(o));
      const objs = await fabric.util.enlivenObjects(JSON.parse(target));
      objs.forEach((o) => canvas.add(o));
      unlockAll(canvas); // після відкату активного шару немає — всі доступні
      canvas.requestRenderAll();
    } catch (e) {
      console.error("Undo failed:", e);
    } finally {
      restoringRef.current = false;
    }
    manualSync?.();
  }, [activeCanvas, manualSync]);

  return { undo, canUndo };
}
