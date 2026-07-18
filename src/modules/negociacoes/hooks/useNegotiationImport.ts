// Hook de aplicação do importador. Regra fica no serviço; persistência no repositório.
// O componente só orquestra etapas e estado de UI.
import { useCallback, useState } from "react";
import {
  commitImport,
  loadBrokers,
  loadClients,
  loadUnits,
  undoImport,
  type CommitImportInput,
  type CommitImportResult,
  type UndoImportResult,
} from "../../../infra/repositories/negotiationImportsSupabaseRepository";
import type {
  BrokerCandidate,
  ClientCandidate,
  UnitCandidate,
} from "../../../services/negotiationImport";

type UseNegotiationImportResult = {
  brokers: BrokerCandidate[];
  units: UnitCandidate[];
  clients: ClientCandidate[];
  isLoadingRef: boolean;
  isCommitting: boolean;
  isUndoing: boolean;
  errorMessage: string | null;
  lastResult: CommitImportResult | null;
  loadReference: () => Promise<boolean>;
  runCommit: (input: CommitImportInput) => Promise<CommitImportResult | null>;
  runUndo: (batchId: string) => Promise<UndoImportResult | null>;
  clearError: () => void;
};

export function useNegotiationImport(
  accountId: string | null,
  developmentId: string | null,
): UseNegotiationImportResult {
  const [brokers, setBrokers] = useState<BrokerCandidate[]>([]);
  const [units, setUnits] = useState<UnitCandidate[]>([]);
  const [clients, setClients] = useState<ClientCandidate[]>([]);
  const [isLoadingRef, setIsLoadingRef] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CommitImportResult | null>(null);

  const loadReference = useCallback(async (): Promise<boolean> => {
    if (!accountId || !developmentId) {
      setErrorMessage("Selecione uma conta e um empreendimento.");
      return false;
    }
    setIsLoadingRef(true);
    setErrorMessage(null);
    try {
      const [b, u, c] = await Promise.all([
        loadBrokers(accountId),
        loadUnits(accountId, developmentId),
        loadClients(accountId),
      ]);
      setBrokers(b);
      setUnits(u);
      setClients(c);
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao carregar dados de apoio.");
      return false;
    } finally {
      setIsLoadingRef(false);
    }
  }, [accountId, developmentId]);

  const runCommit = useCallback(
    async (input: CommitImportInput): Promise<CommitImportResult | null> => {
      setIsCommitting(true);
      setErrorMessage(null);
      try {
        const result = await commitImport(input);
        setLastResult(result);
        return result;
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Falha ao importar negociações.");
        return null;
      } finally {
        setIsCommitting(false);
      }
    },
    [],
  );

  const runUndo = useCallback(async (batchId: string): Promise<UndoImportResult | null> => {
    setIsUndoing(true);
    setErrorMessage(null);
    try {
      return await undoImport(batchId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Falha ao desfazer importação.");
      return null;
    } finally {
      setIsUndoing(false);
    }
  }, []);

  return {
    brokers,
    units,
    clients,
    isLoadingRef,
    isCommitting,
    isUndoing,
    errorMessage,
    lastResult,
    loadReference,
    runCommit,
    runUndo,
    clearError: () => setErrorMessage(null),
  };
}
