// R1 · Fundação fluida — "container query" para o padrão inline-style (T.*).
// `@container`/`@media` não existem no inline style; onde a mudança é ESTRUTURAL
// (empilhar↔lado-a-lado pela largura do PRÓPRIO container, não do viewport) usamos
// um ResizeObserver que mede o elemento e devolve sua largura. O componente ramifica
// no espaço real disponível — imune ao paradoxo "1024 paisagem é mais estreito que
// 834 retrato". Interação continua arbitrada só por useIsTouch (nunca por largura).
import { useEffect, useRef, useState } from "react";

/**
 * @returns [ref, width] — anexe `ref` ao elemento; `width` é a largura de conteúdo
 * medida (0 até a 1ª medição / SSR). Ramifique layout por `width`, não por viewport.
 */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Mede imediatamente (evita 1 frame em 0) e observa mudanças.
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect?.width ?? (e.target as HTMLElement).getBoundingClientRect().width;
        setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}
