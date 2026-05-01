import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBreakpoint } from "../useBreakpoint";

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: w });
}

describe("useBreakpoint", () => {
  it("mobile (500px)", () => {
    setWidth(500);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
  });

  it("tablet (800px)", () => {
    setWidth(800);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isDesktop).toBe(false);
  });

  it("desktop (1200px)", () => {
    setWidth(1200);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
  });

  it("limiar 768: tablet", () => {
    setWidth(768);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isMobile).toBe(false);
    expect(result.current.isTablet).toBe(true);
  });

  it("limiar 1024: desktop", () => {
    setWidth(1024);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(true);
  });

  it("width reportado", () => {
    setWidth(1337);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current.width).toBe(1337);
  });
});
