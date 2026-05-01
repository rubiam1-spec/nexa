import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Feature flag SHOW_LOGIN_MURAL está desligada em produção (Login v7.1).
// Estes testes validam a mecânica de fetch/cache — forçamos o flag=true.
vi.mock("../config", () => ({ SHOW_LOGIN_MURAL: true }));

import { useLoginMural, __TEST__ } from "../hooks/useLoginMural";
import { LOGIN_MURAL_FALLBACK } from "../types/loginMural";

describe("useLoginMural", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    __TEST__.reset();
    fetchSpy.mockReset();
  });

  afterEach(() => {
    __TEST__.reset();
  });

  it("chama a Edge Function na URL correta", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          kind: "manifesto",
          headline: "Hello",
          subline: null,
          badge_label: null,
          badge_color: null,
          cta_label: null,
          cta_url: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ) as unknown as Response,
    );

    const { result } = renderHook(() => useLoginMural());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const urlArg = fetchSpy.mock.calls[0][0];
    expect(String(urlArg)).toBe(__TEST__.EDGE_FUNCTION_URL);
    expect(result.current.item?.headline).toBe("Hello");
  });

  it("devolve fallback quando a Edge Function falha", async () => {
    fetchSpy.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useLoginMural());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.item).toEqual(LOGIN_MURAL_FALLBACK);
  });

  it("devolve fallback quando payload é inválido (sem headline)", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ kind: "manifesto" }), { status: 200 }) as unknown as Response,
    );

    const { result } = renderHook(() => useLoginMural());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.item).toEqual(LOGIN_MURAL_FALLBACK);
  });

  it("cacheia entre renders — segundo hook mount não re-fetcha", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          kind: "manifesto",
          headline: "Cached",
          subline: null,
          badge_label: null,
          badge_color: null,
          cta_label: null,
          cta_url: null,
        }),
        { status: 200 },
      ) as unknown as Response,
    );

    const first = renderHook(() => useLoginMural());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(__TEST__.getCache()?.headline).toBe("Cached");

    // Segundo mount — deve servir do cache, sem nova chamada.
    const second = renderHook(() => useLoginMural());
    await waitFor(() => expect(second.result.current.loading).toBe(false));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second.result.current.item?.headline).toBe("Cached");
  });
});
