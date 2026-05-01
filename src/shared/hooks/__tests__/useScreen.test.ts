import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile, useScreen } from "../useIsMobile";

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: w });
  window.dispatchEvent(new Event("resize"));
}

describe("useIsMobile", () => {
  beforeEach(() => setWidth(1280));

  it("retorna false para desktop (1280px)", () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("retorna true para mobile (375px)", () => {
    setWidth(375);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("reage a resize", async () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => setWidth(500));
    expect(result.current).toBe(true);
  });

  it("limiar exato: 767 é mobile", () => {
    setWidth(767);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("limiar exato: 768 NÃO é mobile", () => {
    setWidth(768);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});

describe("useScreen", () => {
  it("iPhone SE (320px): isMobileSmall, isMobile, 1 coluna", () => {
    setWidth(320);
    const { result } = renderHook(() => useScreen());
    const s = result.current;
    expect(s.isMobileSmall).toBe(true);
    expect(s.isMobile).toBe(true);
    expect(s.isTablet).toBe(false);
    expect(s.isDesktop).toBe(false);
    expect(s.columns).toBe(1);
    expect(s.contentPadding).toBe(8);
    expect(s.cardGap).toBe(8);
  });

  it("iPhone 14 (390px): mobile, 2 colunas", () => {
    setWidth(390);
    const { result } = renderHook(() => useScreen());
    const s = result.current;
    expect(s.isMobileSmall).toBe(false);
    expect(s.isMobile).toBe(true);
    expect(s.columns).toBe(2);
    expect(s.contentPadding).toBe(12);
    expect(s.cardGap).toBe(8);
  });

  it("iPad (820px): tablet, 3 colunas", () => {
    setWidth(820);
    const { result } = renderHook(() => useScreen());
    const s = result.current;
    expect(s.isMobile).toBe(false);
    expect(s.isTablet).toBe(true);
    expect(s.isDesktop).toBe(false);
    expect(s.columns).toBe(3);
    expect(s.contentPadding).toBe(16);
    expect(s.cardGap).toBe(12);
  });

  it("desktop (1280px): 4 colunas", () => {
    setWidth(1280);
    const { result } = renderHook(() => useScreen());
    const s = result.current;
    expect(s.isDesktop).toBe(true);
    expect(s.isWide).toBe(false);
    expect(s.columns).toBe(4);
    expect(s.contentPadding).toBe(24);
    expect(s.cardGap).toBe(16);
  });

  it("wide (1440px): isWide, padding 32", () => {
    setWidth(1440);
    const { result } = renderHook(() => useScreen());
    const s = result.current;
    expect(s.isWide).toBe(true);
    expect(s.isDesktop).toBe(true);
    expect(s.contentPadding).toBe(32);
  });

  it("width é reportado corretamente", () => {
    setWidth(999);
    const { result } = renderHook(() => useScreen());
    expect(result.current.width).toBe(999);
  });
});
