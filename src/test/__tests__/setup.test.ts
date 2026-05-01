import { describe, it, expect } from "vitest";

describe("Vitest Setup", () => {
  it("framework funciona", () => {
    expect(1 + 1).toBe(2);
  });

  it("globals estão disponíveis", () => {
    expect(typeof vi).toBe("object");
    expect(typeof describe).toBe("function");
    expect(typeof it).toBe("function");
    expect(typeof expect).toBe("function");
  });

  it("jsdom está ativo", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
  });

  it("localStorage mock funciona", () => {
    localStorage.setItem("test", "value");
    expect(localStorage.getItem("test")).toBe("value");
    localStorage.removeItem("test");
  });
});
