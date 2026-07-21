import { useCallback, useEffect, useState } from "react";
import type { Unidade } from "../../../domain/unidade/Unidade";
import {
  getUnits as getMockUnits,
  updateUnitStatus as updateMockUnitStatus,
} from "../repositories/unitsRepository";
import {
  getUnits as getSupabaseUnits,
  updateUnitStatus as updateSupabaseUnitStatus,
} from "../../../infra/repositories/unitsSupabaseRepository";

type UnitsStatus = "idle" | "loading" | "mock" | "ready" | "empty" | "error";

export function useUnits(
  accountId: string | null,
  developmentId: string | null,
  useMockFallback: boolean,
) {
  const [units, setUnits] = useState<Unidade[]>([]);
  const [status, setStatus] = useState<UnitsStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadUnits() {
      if (!accountId || !developmentId) {
        if (!isMounted) {
          return;
        }

        setUnits([]);
        setStatus("idle");
        setErrorMessage(null);
        return;
      }

      setStatus("loading");
      setErrorMessage(null);

      if (useMockFallback) {
        if (!isMounted) {
          return;
        }

        const mockUnits = getMockUnits(accountId, developmentId);

        setUnits(mockUnits);
        setStatus(mockUnits.length > 0 ? "mock" : "empty");
        return;
      }

      try {
        const realUnits = await getSupabaseUnits(accountId, developmentId);

        if (!isMounted) {
          return;
        }

        setUnits(realUnits);
        setStatus(realUnits.length > 0 ? "ready" : "empty");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setUnits([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar unidades do empreendimento ativo.",
        );
      }
    }

    void loadUnits();

    return () => {
      isMounted = false;
    };
  }, [accountId, developmentId, useMockFallback, refreshKey]);

  const persistUnitStatus = useCallback(
    async (unitId: string, status: Unidade["status"]) => {
      const persistedUnit = useMockFallback
        ? updateMockUnitStatus(unitId, status)
        : await updateSupabaseUnitStatus(unitId, status);

      setUnits((current) =>
        current.map((item) => (item.id === persistedUnit.id ? persistedUnit : item)),
      );

      if (persistedUnit) {
        setStatus((current) => (current === "mock" ? "mock" : "ready"));
      }

      return persistedUnit;
    },
    [useMockFallback],
  );

  return {
    units,
    isLoading: status === "loading",
    isUsingMock: status === "mock",
    status,
    errorMessage,
    replaceUnit: (unit: Unidade) =>
      setUnits((current) =>
        current.map((item) => (item.id === unit.id ? unit : item)),
      ),
    persistUnitStatus,
    refetch: () => setRefreshKey((k) => k + 1),
  };
}
