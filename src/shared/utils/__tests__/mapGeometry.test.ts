import { describe, it, expect } from "vitest";
import { imageAspectRatio, pinScreenPosition } from "../mapGeometry";

describe("pinScreenPosition", () => {
  it("devolve left/top em % diretamente", () => {
    expect(pinScreenPosition(0, 0)).toEqual({ left: "0%", top: "0%" });
    expect(pinScreenPosition(50, 50)).toEqual({ left: "50%", top: "50%" });
    expect(pinScreenPosition(100, 100)).toEqual({ left: "100%", top: "100%" });
  });

  it("preserva frações", () => {
    expect(pinScreenPosition(33.7, 12.5)).toEqual({ left: "33.7%", top: "12.5%" });
  });

  it("ignora container dims sem alterar resultado (premissa: aspect-ratio iguala pin e img)", () => {
    expect(pinScreenPosition(40, 60, 375, 250)).toEqual({ left: "40%", top: "60%" });
    expect(pinScreenPosition(40, 60, 1200, 800)).toEqual({ left: "40%", top: "60%" });
  });
});

describe("imageAspectRatio", () => {
  it("devolve width/height quando ambos > 0", () => {
    expect(imageAspectRatio(1200, 800)).toBeCloseTo(1.5);
    expect(imageAspectRatio(375, 500)).toBeCloseTo(0.75);
    expect(imageAspectRatio(1, 1)).toBe(1);
  });

  it("devolve null para dimensões zero ou invalidas", () => {
    expect(imageAspectRatio(0, 800)).toBeNull();
    expect(imageAspectRatio(1200, 0)).toBeNull();
    expect(imageAspectRatio(0, 0)).toBeNull();
    expect(imageAspectRatio(NaN, 800)).toBeNull();
    expect(imageAspectRatio(1200, NaN)).toBeNull();
    expect(imageAspectRatio(-1200, 800)).toBeNull();
  });
});
