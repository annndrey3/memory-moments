import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// IntersectionObserver-хук: повертає [ref, inView]. Спрацьовує один раз —
// коли елемент уперше потрапляє у в'юпорт. За prefers-reduced-motion (або без
// підтримки IO) одразу повертає true, щоб контент був видимим без анімації.
export function useInView({ threshold = 0.12, rootMargin = "0px 0px -8% 0px" } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView];
}

// Готова обгортка: плавно з'являється (fade + підйом) під час прокрутки.
// Приклад: <Reveal as="section" delay={120} className="mb-8">…</Reveal>
export function Reveal({ as: Tag = "div", className, delay = 0, children, ...props }) {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
      className={cn(
        "transition-all duration-700 ease-out motion-reduce:transition-none",
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
