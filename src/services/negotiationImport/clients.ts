// Detecção de provável duplicata de cliente (gated): só oferecemos vínculo quando
// o nome é muito próximo de um contato existente da conta. Caso contrário, cria novo.
import type { ClientCandidate, RankedOption } from "./types";
import { normalizeName, similarity } from "./text";

const CLIENT_THRESHOLD = 0.84;

export function hasProbableClientMatch(
  name: string | null,
  clients: ClientCandidate[],
): boolean {
  if (!name) return false;
  const n = normalizeName(name);
  return clients.some((c) => normalizeName(c.name) === n || similarity(name, c.name) >= CLIENT_THRESHOLD);
}

// Opções ranqueadas para o combobox de cliente: prováveis no topo.
export function rankClientOptions(
  name: string | null,
  clients: ClientCandidate[],
): RankedOption[] {
  return clients
    .map((c) => ({ c, sim: name ? similarity(name, c.name) : 0 }))
    .sort((x, y) => y.sim - x.sim)
    .map(({ c, sim }) => ({
      id: c.id,
      label: c.name,
      group: sim >= CLIENT_THRESHOLD ? "Provável" : "Contatos",
      confidence: sim >= CLIENT_THRESHOLD ? sim : undefined,
    }));
}
