import { useEffect, useState } from "react";

function getWidth() { return typeof window !== "undefined" ? window.innerWidth : 1280; }

export interface Screen {
  width: number;
  isMobileSmall: boolean; // < 375 (iPhone SE)
  isMobile: boolean;      // < 768
  isTablet: boolean;      // 768–1023
  isDesktop: boolean;     // >= 1024
  isWide: boolean;        // >= 1440
  columns: number;        // grid columns for KPIs
  contentPadding: number;
  cardGap: number;
}

function calc(w: number): Screen {
  const isMobileSmall = w < 375;
  const isMobile = w < 768;
  const isTablet = w >= 768 && w < 1024;
  const isDesktop = w >= 1024;
  const isWide = w >= 1440;

  let columns = 4;
  if (isMobileSmall) columns = 1;
  else if (isMobile) columns = 2;
  else if (isTablet) columns = 3;

  let contentPadding = 24;
  if (isMobileSmall) contentPadding = 8;
  else if (isMobile) contentPadding = 12;
  else if (isTablet) contentPadding = 16;
  else if (isWide) contentPadding = 32;

  let cardGap = 16;
  if (isMobile) cardGap = 8;
  else if (isTablet) cardGap = 12;

  return { width: w, isMobileSmall, isMobile, isTablet, isDesktop, isWide, columns, contentPadding, cardGap };
}

/** Full screen info */
export function useScreen(): Screen {
  const [screen, setScreen] = useState(() => calc(getWidth()));
  useEffect(() => {
    let raf = 0;
    function handle() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setScreen(calc(getWidth()))); }
    window.addEventListener("resize", handle);
    return () => { window.removeEventListener("resize", handle); cancelAnimationFrame(raf); };
  }, []);
  return screen;
}

/** Backward-compatible boolean hook */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => getWidth() < 768);
  useEffect(() => {
    function handle() { setIsMobile(getWidth() < 768); }
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);
  return isMobile;
}
