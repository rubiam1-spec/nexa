// Grafo de navegação — builders canônicos de rota por entidade.
// Lei 1: UMA casa por entidade. Lei 2: FK no banco ⇒ link na UI.
// A Unidade é um modal endereçável via deep-link ?unidade=<id> (Fase 0.3).
export type EntityKind = "contact" | "negotiation" | "unit" | "broker";

export const contactRoute = (id: string): string => `/contatos/${id}`;
export const negotiationRoute = (id: string): string => `/negociacoes/${id}`;
export const brokerRoute = (id: string): string => `/corretores/${id}`;
export const unitRoute = (unitId: string, _devId?: string): string => `/unidades?unidade=${unitId}`;

export function entityRoute(kind: EntityKind, id: string, devId?: string): string {
  switch (kind) {
    case "contact": return contactRoute(id);
    case "negotiation": return negotiationRoute(id);
    case "unit": return unitRoute(id, devId);
    case "broker": return brokerRoute(id);
  }
}

// Casa da LISTA de cada entidade — fallback do "voltar" (Lei 3).
export const ENTITY_LIST_HOME: Record<EntityKind, { to: string; label: string }> = {
  contact: { to: "/contatos", label: "Contatos" },
  negotiation: { to: "/negociacoes", label: "Negociações" },
  unit: { to: "/unidades", label: "Unidades" },
  broker: { to: "/corretores", label: "Corretores" },
};

// Rótulo curto de uma rota conhecida — usado no "← <origem>" (Lei 3/4).
export function routeLabel(pathname: string): string {
  if (pathname === "/" || pathname.startsWith("/central")) return "Central";
  if (pathname.startsWith("/leads")) return "Leads";
  if (pathname.startsWith("/negociacoes")) return "Negociações";
  if (pathname.startsWith("/contatos")) return "Contatos";
  if (pathname.startsWith("/unidades")) return "Unidades";
  if (pathname.startsWith("/corretores")) return "Corretores";
  return "Voltar";
}
