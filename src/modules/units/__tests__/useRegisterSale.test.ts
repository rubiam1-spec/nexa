import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useRegisterSale } from "../hooks/useRegisterSale";

// supabase é mockado no setup global; controlamos apenas o rpc por teste. Assim
// exercitamos o repositório REAL (registerHistoricalSale) sobre o contrato do RPC.
const rpc = vi.mocked(supabase!.rpc);
beforeEach(() => rpc.mockReset());

describe("useRegisterSale — orquestração (repo real + RPC mockado)", () => {
  it("sucesso: repassa params, retorna {saleId, unitStatus} e invalida consumidores", async () => {
    rpc.mockResolvedValue({ data: { sale_id: "s1", unit_status: "sold" }, error: null } as never);
    const onDone = vi.fn();
    const { result } = renderHook(() => useRegisterSale(onDone));

    let ret: unknown;
    await act(async () => { ret = await result.current.submit("u1", "c1", 949000, "2024-05-01"); });

    expect(rpc).toHaveBeenCalledWith("register_historical_sale", { p_unit_id: "u1", p_client_id: "c1", p_amount: 949000, p_sale_date: "2024-05-01" });
    expect(ret).toEqual({ saleId: "s1", unitStatus: "sold" });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.errorMessage).toBeNull();
  });

  it("data null ('não informada') é repassada como null", async () => {
    rpc.mockResolvedValue({ data: { sale_id: "s2", unit_status: "sold" }, error: null } as never);
    const { result } = renderHook(() => useRegisterSale());

    await act(async () => { await result.current.submit("u1", "c1", 500000, null); });

    expect(rpc).toHaveBeenCalledWith("register_historical_sale", { p_unit_id: "u1", p_client_id: "c1", p_amount: 500000, p_sale_date: null });
  });

  it("sale_already_registered: mensagem PT-BR, retorna null, não invalida", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "sale_already_registered" } } as never);
    const onDone = vi.fn();
    const { result } = renderHook(() => useRegisterSale(onDone));

    let ret: unknown;
    await act(async () => { ret = await result.current.submit("u1", "c1", 100, null); });
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(ret).toBeNull();
    expect(result.current.errorMessage).toBe("Esta unidade já tem venda registrada.");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("client_not_found: mensagem PT-BR de comprador não encontrado", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "client_not_found" } } as never);
    const { result } = renderHook(() => useRegisterSale());

    await act(async () => { await result.current.submit("u1", "c1", 100, null); });
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(result.current.errorMessage).toBe("Comprador não encontrado.");
  });
});
