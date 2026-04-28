// NEXA — Camada 3 (Documentos), Sprint B.3.0a
// Hook de leitura/edição da matriz papel × documento de um
// empreendimento. Carrega catálogo + requirements em paralelo,
// expõe toggleRequirement (ciclo missing → required → optional →
// missing) e restoreDefaults.

import { useCallback, useEffect, useState } from "react";
import {
  listByDevelopment,
  listCatalog,
  removeRequirement,
  restoreDefaults as restoreDefaultsRepo,
  setRequirement,
} from "../../../infra/repositories/documentRequirementsSupabaseRepository";
import type {
  DocumentRequirementWithType,
  DocumentType,
  PartyRole,
  RequirementCellState,
} from "../../../shared/types/documentRequirement";

export interface UseDocumentRequirementsResult {
  catalog: DocumentType[];
  requirements: DocumentRequirementWithType[];
  isLoading: boolean;
  errorMessage: string | null;
  /** ID da célula em mutação (formato `${role}:${typeId}`). */
  mutatingCell: string | null;
  toggleRequirement: (
    partyRole: PartyRole,
    documentTypeId: string,
    currentState: RequirementCellState,
  ) => Promise<void>;
  restoreDefaults: () => Promise<void>;
  refresh: () => Promise<void>;
}

function nextState(current: RequirementCellState): RequirementCellState {
  if (current === "missing") return "required";
  if (current === "required") return "optional";
  return "missing";
}

export function useDocumentRequirements(
  developmentId: string | null,
  accountId: string | null,
): UseDocumentRequirementsResult {
  const [catalog, setCatalog] = useState<DocumentType[]>([]);
  const [requirements, setRequirements] = useState<DocumentRequirementWithType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mutatingCell, setMutatingCell] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!developmentId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [cat, reqs] = await Promise.all([
        listCatalog(),
        listByDevelopment(developmentId),
      ]);
      setCatalog(cat);
      setRequirements(reqs);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao carregar documentos requeridos.");
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    if (!developmentId) {
      setCatalog([]);
      setRequirements([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [cat, reqs] = await Promise.all([
          listCatalog(),
          listByDevelopment(developmentId),
        ]);
        if (cancelled) return;
        setCatalog(cat);
        setRequirements(reqs);
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : "Falha ao carregar documentos requeridos.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [developmentId]);

  const toggleRequirement = useCallback(
    async (
      partyRole: PartyRole,
      documentTypeId: string,
      currentState: RequirementCellState,
    ) => {
      if (!developmentId || !accountId) {
        setErrorMessage("Contexto de empreendimento/conta ausente.");
        return;
      }
      const cellKey = `${partyRole}:${documentTypeId}`;
      setMutatingCell(cellKey);
      setErrorMessage(null);
      const target = nextState(currentState);
      try {
        if (target === "missing") {
          const existing = requirements.find(
            (r) => r.partyRole === partyRole && r.documentTypeId === documentTypeId,
          );
          if (existing) await removeRequirement(existing.id);
        } else {
          await setRequirement(
            developmentId,
            accountId,
            partyRole,
            documentTypeId,
            target === "required",
          );
        }
        // Re-fetch para refletir estado real
        const fresh = await listByDevelopment(developmentId);
        setRequirements(fresh);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Falha ao atualizar requirement.");
      } finally {
        setMutatingCell(null);
      }
    },
    [developmentId, accountId, requirements],
  );

  const restoreDefaults = useCallback(async () => {
    if (!developmentId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await restoreDefaultsRepo(developmentId);
      const fresh = await listByDevelopment(developmentId);
      setRequirements(fresh);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Falha ao restaurar defaults.");
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  return {
    catalog,
    requirements,
    isLoading,
    errorMessage,
    mutatingCell,
    toggleRequirement,
    restoreDefaults,
    refresh,
  };
}
