import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { UnidadeStatus } from "../../../domain/unidade/UnidadeStatus";
import { supabase } from "../../../infra/supabase/supabaseClient";
import { useUnitStatusChange } from "../hooks/useUnitStatusChange";

// supabase é mockado no setup global; controlamos apenas o rpc por teste. Assim
// exercitamos o repositório REAL (updateStatusBulk) sobre o contrato do RPC.
const rpc = vi.mocked(supabase!.rpc);
beforeEach(() => rpc.mockReset());

describe("useUnitStatusChange — orquestração (repo real + RPC mockado)", () => {
  it("sucesso total: seta result e invalida consumidores", async () => {
    rpc.mockResolvedValue({ data: { updated: 2, blocked: [] }, error: null } as never);
    const onChanged = vi.fn();
    const { result } = renderHook(() => useUnitStatusChange(onChanged));

    await act(async () => { await result.current.submit(["u1", "u2"], UnidadeStatus.DISPONIVEL, "motivo ok"); });

    // DISPONIVEL → db "available"; motivo repassado; batch íntegro.
    expect(rpc).toHaveBeenCalledWith("bulk_update_unit_status", { p_unit_ids: ["u1", "u2"], p_new_status: "available", p_reason: "motivo ok" });
    expect(result.current.result).toEqual({ updated: 2, blocked: [] });
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(result.current.errorMessage).toBeNull();
  });

  it("sucesso parcial (X ok + Y bloqueadas) é sucesso: invalida e expõe bloqueadas", async () => {
    rpc.mockResolvedValue({ data: { updated: 1, blocked: [{ unit_id: "u2", reason: "active_reservation" }] }, error: null } as never);
    const onChanged = vi.fn();
    const { result } = renderHook(() => useUnitStatusChange(onChanged));

    await act(async () => { await result.current.submit(["u1", "u2"], UnidadeStatus.DISPONIVEL, "motivo ok"); });

    expect(result.current.result?.updated).toBe(1);
    expect(result.current.result?.blocked).toHaveLength(1);
    expect(result.current.result?.blocked[0].reason).toBe("active_reservation");
    expect(onChanged).toHaveBeenCalledTimes(1); // updated > 0 → invalida
    expect(result.current.errorMessage).toBeNull();
  });

  it("exception reason_required (error do RPC): mensagem PT-BR, sem result, sem invalidar", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "reason_required" } } as never);
    const onChanged = vi.fn();
    const { result } = renderHook(() => useUnitStatusChange(onChanged));

    await act(async () => { await result.current.submit(["u1"], UnidadeStatus.VENDIDO, "abc"); });
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));

    expect(result.current.result).toBeNull();
    expect(result.current.errorMessage).toBe("Informe um motivo (mínimo 5 caracteres).");
    expect(onChanged).not.toHaveBeenCalled();
  });
});
