// N4 · FONTE ÚNICA do sino (merge PURO/testável). Une DUAS fontes:
//   • notifications (por-usuário) — eventos, link por action_url, estado read/unread
//   • intelligence_alerts (por-conta) — motor N1, link por metadata, resolvível
// operational_alerts é DELIBERADAMENTE EXCLUÍDA: é uma view derivada cujas
// condições (parada/follow-up/reserva) já chegam ao usuário como notifications de
// cadência — incluí-la crua duplicaria o aviso com escopo errado (por-conta num
// sino por-usuário). Sem quarta fonte.
//
// DEDUPE do par (notification de cadência ↔ alerta do motor de MESMA origem): a
// chave de origem é o id de ENTIDADE (metadata do alerta ↔ id na action_url da
// notification) ou, na ausência, o título normalizado. Na colisão o ALERTA vence
// (acionável/resolvível) e a notification é suprimida — o mesmo aviso nunca 2x.
import { contactRoute, negotiationRoute, simulationRoute, unitRoute } from "../navigation/entityRoutes";

export type FeedSource = "notification" | "intelligence";
export type FeedPriority = "critical" | "warning" | "info";

export type FeedNotification = { id: string; type: string; title: string; message: string | null; action_url: string | null; read: boolean; created_at: string };
export type FeedAlert = { id: string; alert_type: string; priority: FeedPriority; title: string; message: string | null; metadata: Record<string, unknown> | null; created_at: string };

export type FeedItem = {
  id: string;            // "notif:<id>" | "intel:<id>"
  rawId: string;         // id cru (markAsRead / resolveAlert)
  source: FeedSource;
  priority: FeedPriority;
  title: string;
  message: string | null;
  link: string | null;   // link à entidade (grafo)
  createdAt: string;
  read: boolean;         // notification: read/unread · alerta: sempre false (vivo)
  resolvable: boolean;   // só intelligence_alerts
};

const WEEK_MS = 7 * 86_400_000;
const PRIO_RANK: Record<FeedPriority, number> = { critical: 0, warning: 1, info: 2 };

// Tipos de notification urgentes → warning; o resto é info. Critical é exclusivo
// do motor (intelligence_alerts). Ordenação do sino usa esse ranking.
const NOTIF_WARNING = new Set(["followup_overdue", "negotiation_stale", "reservation_expiring", "reservation_rejected", "proposal_rejected", "doc_rejected", "property_rejected", "update_request"]);
function notifPriority(type: string): FeedPriority {
  return NOTIF_WARNING.has(type) ? "warning" : "info";
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// id de entidade a partir da action_url (/contatos/:id, /negociacoes/:id,
// ?simulationId=, ?unidade=).
export function entityIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const path = url.match(/\/(?:contatos|negociacoes)\/([0-9a-fA-F-]{8,})/);
  if (path) return path[1];
  const q = url.match(/(?:simulationId|unidade|clientId)=([0-9a-fA-F-]{8,})/);
  return q ? q[1] : null;
}

// Link do alerta pela metadata (Lei 2 · entityRoutes). Contato primeiro (a ficha
// é o hub do organismo), depois negociação/simulação/unidade.
function alertLink(metadata: Record<string, unknown> | null): string | null {
  const m = metadata ?? {};
  const clientId = m.client_id as string | undefined;
  const negId = m.negotiation_id as string | undefined;
  const simId = m.simulation_id as string | undefined;
  const unitId = m.unit_id as string | undefined;
  if (clientId) return contactRoute(clientId);
  if (negId) return negotiationRoute(negId);
  if (simId) return simulationRoute(simId);
  if (unitId) return unitRoute(unitId);
  return null;
}

function alertEntityId(metadata: Record<string, unknown> | null): string | null {
  const m = metadata ?? {};
  return (m.client_id as string) || (m.negotiation_id as string) || (m.simulation_id as string) || (m.unit_id as string) || null;
}

const originKeyAlert = (a: FeedAlert) => { const e = alertEntityId(a.metadata); return e ? `e:${e}` : `t:${norm(a.title)}`; };
const originKeyNotif = (n: FeedNotification) => { const e = entityIdFromUrl(n.action_url); return e ? `e:${e}` : `t:${norm(n.title)}`; };

/** Merge das 2 fontes → lista única. Alertas já vêm não-resolvidos/não-expirados
 *  da query. Dedupe do par (o alerta vence). Ordena por prioridade e recência. */
export function buildNotificationFeed(notifications: FeedNotification[], alerts: FeedAlert[], _nowMs: number = Date.now()): FeedItem[] {
  const items: FeedItem[] = [];

  const alertKeys = new Set(alerts.map(originKeyAlert));

  for (const a of alerts) {
    items.push({
      id: `intel:${a.id}`, rawId: a.id, source: "intelligence", priority: a.priority,
      title: a.title, message: a.message, link: alertLink(a.metadata),
      createdAt: a.created_at, read: false, resolvable: true,
    });
  }
  for (const n of notifications) {
    if (alertKeys.has(originKeyNotif(n))) continue; // dedupe: coberto por um alerta
    items.push({
      id: `notif:${n.id}`, rawId: n.id, source: "notification", priority: notifPriority(n.type),
      title: n.title, message: n.message, link: n.action_url,
      createdAt: n.created_at, read: n.read, resolvable: false,
    });
  }

  return items.sort((x, y) => {
    const p = PRIO_RANK[x.priority] - PRIO_RANK[y.priority];
    if (p !== 0) return p;
    return new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime();
  });
}

/** Badge = SÓ ACIONÁVEIS: alertas (todos, não-resolvidos) + notifications não
 *  lidas dos últimos 7 dias. Velharia (>7d) NÃO conta. */
export function feedBadgeCount(items: FeedItem[], nowMs: number = Date.now()): number {
  return items.filter((it) => {
    if (it.source === "intelligence") return true; // alerta vivo é sempre acionável
    if (it.read) return false;
    return nowMs - new Date(it.createdAt).getTime() <= WEEK_MS; // notification recente
  }).length;
}
