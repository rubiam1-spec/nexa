import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ThemeMode } from "./tokens";
import { applyTheme, getResolvedTheme } from "./applyTheme";

interface ThemeContextValue { theme: ThemeMode; resolvedTheme: "dark" | "light"; setTheme: (mode: ThemeMode) => void }

const ThemeContext = createContext<ThemeContextValue>({ theme: "dark", resolvedTheme: "dark", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => { try { return (localStorage.getItem("nexa-theme") as ThemeMode) || "dark"; } catch { return "dark"; } });
  const resolved = getResolvedTheme(theme);
  const setTheme = useCallback((m: ThemeMode) => { setThemeState(m); try { localStorage.setItem("nexa-theme", m); } catch {} }, []);
  useEffect(() => { applyTheme(resolved); }, [resolved]);
  useEffect(() => { if (theme !== "auto") return; const mq = window.matchMedia("(prefers-color-scheme: dark)"); const h = () => applyTheme(getResolvedTheme("auto")); mq.addEventListener("change", h); return () => mq.removeEventListener("change", h); }, [theme]);
  return <ThemeContext.Provider value={{ theme, resolvedTheme: resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }
