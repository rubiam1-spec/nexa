import { useCallback, useEffect, useState } from "react";
import {
  getLeadDistSettings,
  updateLeadDistSettings,
  getLeadDistParticipants,
  getEligiblePeople,
  addParticipant,
  removeParticipant,
  setParticipantActive,
  setParticipantWeight,
  resetCounts,
  type LeadDistParticipant,
  type EligiblePerson,
} from "../../../infra/repositories/leadDistributionSupabaseRepository";

/**
 * Estado + ações da tela de gestão da Distribuição de Leads. Toda a
 * persistência fica no repositório Supabase; o componente só renderiza e
 * dispara intenções (regra fora do componente).
 */
export function useLeadDistributionAdmin(accountId: string | null, developmentId: string | null) {
  const [enabled, setEnabled] = useState(false);
  const [eligibleRoles, setEligibleRoles] = useState<string[]>(["commercial_consultant"]);
  const [participants, setParticipants] = useState<LeadDistParticipant[]>([]);
  const [eligiblePeople, setEligiblePeople] = useState<EligiblePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const s = await getLeadDistSettings(accountId);
      setEnabled(s.enabled);
      setEligibleRoles(s.eligibleRoles);
      const [parts, people] = await Promise.all([
        getLeadDistParticipants(accountId),
        getEligiblePeople(accountId, s.eligibleRoles),
      ]);
      setParticipants(parts);
      setEligiblePeople(people);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar distribuição.");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => { void reload(); }, [reload]);

  const withBusy = useCallback(async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }, [busy, reload]);

  const toggleEnabled = (v: boolean) => withBusy(async () => { if (accountId) await updateLeadDistSettings(accountId, { enabled: v }); });
  const saveEligibleRoles = (roles: string[]) => withBusy(async () => { if (accountId) await updateLeadDistSettings(accountId, { eligibleRoles: roles }); });
  const add = (consultantId: string) => withBusy(async () => { if (accountId) await addParticipant(accountId, developmentId, consultantId); });
  const remove = (id: string) => withBusy(async () => { await removeParticipant(id); });
  const toggleActive = (id: string, active: boolean) => withBusy(async () => { await setParticipantActive(id, active); });
  const setWeight = (id: string, weight: number) => withBusy(async () => { await setParticipantWeight(id, weight); });
  const reset = () => withBusy(async () => { if (accountId) await resetCounts(accountId); });

  const participantIds = new Set(participants.map((p) => p.consultantId));
  const addable = eligiblePeople.filter((p) => !participantIds.has(p.userId));

  return {
    enabled, eligibleRoles, participants, addable, loading, busy, error,
    toggleEnabled, saveEligibleRoles, add, remove, toggleActive, setWeight, reset,
  };
}
