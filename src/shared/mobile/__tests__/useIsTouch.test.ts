import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useIsTouch } from "../useIsTouch";
import { TOUCH_TARGET } from "../tokens";

function mockMatchMedia(coarse: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches: coarse,
    media: "(pointer: coarse)",
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => true,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return mql;
}

const original = window.matchMedia;
beforeEach(() => vi.restoreAllMocks());
afterEach(() => { window.matchMedia = original; });

describe("useIsTouch — pointer: coarse (não largura)", () => {
  it("true quando o dispositivo é coarse (toque)", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsTouch());
    expect(result.current).toBe(true);
  });

  it("false quando é fine (mouse)", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsTouch());
    expect(result.current).toBe(false);
  });

  it("TOUCH_TARGET é 44", () => {
    expect(TOUCH_TARGET).toBe(44);
  });
});
