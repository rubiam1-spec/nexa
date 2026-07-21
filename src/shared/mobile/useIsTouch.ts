import { useEffect, useState } from "react";

// Toque REAL via `(pointer: coarse)` — independe da largura da janela. Um desktop
// estreito NÃO é toque; um tablet largo É. Usado para gates de interação (ex.
// tap-to-reveal em gráficos) sem afetar quem usa mouse.
function query(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function useIsTouch(): boolean {
  const [touch, setTouch] = useState<boolean>(query);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(pointer: coarse)");
    const handler = () => setTouch(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler); // Safari < 14
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);
  return touch;
}
