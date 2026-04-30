import { type ThemeTokens, TOKEN_TO_CSS, darkTokens, lightTokens } from "./tokens";

export function applyTheme(mode: "dark" | "light"): void {
  const tokens = mode === "dark" ? darkTokens : lightTokens;
  const root = document.documentElement;
  (Object.keys(tokens) as (keyof ThemeTokens)[]).forEach((key) => {
    root.style.setProperty(TOKEN_TO_CSS[key], tokens[key]);
  });
  root.setAttribute("data-theme", mode);
}

export function getResolvedTheme(pref: "dark" | "light" | "auto"): "dark" | "light" {
  if (pref === "auto") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return pref;
}
