// N4 · testes do merge/ordenação/dedupe/badge/link do sino.
import { describe, it, expect } from "vitest";
import { buildNotificationFeed, feedBadgeCount, entityIdFromUrl, type FeedNotification, type FeedAlert } from "../notificationFeed";

const NOW = new Date("2026-07-30T12:00:00Z").getTime();
const notif = (p: Partial<FeedNotification>): FeedNotification => ({ id: "n1", type: "new_lead", title: "Novo lead", message: null, action_url: "/leads", read: false, created_at: "2026-07-30T10:00:00Z", ...p });
const alert = (p: Partial<FeedAlert>): FeedAlert => ({ id: "a1", alert_type: "negotiation_idle", priority: "warning", title: "Parada há 76h", message: null, metadata: null, created_at: "2026-07-30T09:00:00Z", ...p });

describe("buildNotificationFeed — merge, ordenação, link", () => {
  it("une as 2 fontes e ordena por prioridade > recência", () => {
    const feed = buildNotificationFeed(
      [notif({ id: "n1", created_at: "2026-07-30T11:00:00Z" })],
      [alert({ id: "a1", priority: "critical", created_at: "2026-07-30T08:00:00Z" }), alert({ id: "a2", priority: "info", created_at: "2026-07-30T11:30:00Z" })],
      NOW,
    );
    // critical primeiro (apesar de mais antigo); depois info@11:30 vs notif(info)@11:00
    expect(feed.map((f) => f.id)).toEqual(["intel:a1", "intel:a2", "notif:n1"]);
  });

  it("link do alerta pela metadata (contato primeiro), notification pela action_url", () => {
    const feed = buildNotificationFeed(
      [notif({ action_url: "/negociacoes/xxxx1111-2222" })],
      [alert({ metadata: { client_id: "cli-abc12345", negotiation_id: "neg-9" } })],
      NOW,
    );
    expect(feed.find((f) => f.source === "intelligence")!.link).toBe("/contatos/cli-abc12345");
    expect(feed.find((f) => f.source === "notification")!.link).toBe("/negociacoes/xxxx1111-2222");
  });

  it("intelligence é resolvível; notification não", () => {
    const feed = buildNotificationFeed([notif({})], [alert({})], NOW);
    expect(feed.find((f) => f.source === "intelligence")!.resolvable).toBe(true);
    expect(feed.find((f) => f.source === "notification")!.resolvable).toBe(false);
  });
});

describe("dedupe — o par (notification ↔ alerta de mesma origem) não aparece 2x", () => {
  it("por id de entidade (action_url ↔ metadata): o alerta vence", () => {
    const feed = buildNotificationFeed(
      [notif({ id: "n1", type: "negotiation_stale", title: "Negociação parada", action_url: "/negociacoes/aaa77700-bbbb-cccc" })],
      [alert({ id: "a1", metadata: { negotiation_id: "aaa77700-bbbb-cccc" } })],
      NOW,
    );
    expect(feed).toHaveLength(1);
    expect(feed[0].source).toBe("intelligence");
  });
  it("por título normalizado quando não há id de entidade", () => {
    const feed = buildNotificationFeed(
      [notif({ id: "n1", title: "Follow-up vencido: Contato", action_url: "/atividades" })],
      [alert({ id: "a1", title: "follow-up vencido: contato", metadata: null })],
      NOW,
    );
    expect(feed).toHaveLength(1);
    expect(feed[0].source).toBe("intelligence");
  });
  it("avisos diferentes NÃO deduplicam", () => {
    const feed = buildNotificationFeed(
      [notif({ id: "n1", title: "Novo lead: Gisele", action_url: "/leads" })],
      [alert({ id: "a1", title: "Parada há 76h", metadata: { negotiation_id: "neg-1" } })],
      NOW,
    );
    expect(feed).toHaveLength(2);
  });
});

describe("feedBadgeCount — só acionáveis (alertas + notifications não lidas ≤7d)", () => {
  it("alerta vivo conta sempre; notification recente não lida conta", () => {
    const feed = buildNotificationFeed([notif({ id: "n1", read: false, created_at: "2026-07-29T12:00:00Z" })], [alert({ id: "a1" })], NOW);
    expect(feedBadgeCount(feed, NOW)).toBe(2);
  });
  it("velharia (>7d) NÃO conta", () => {
    const feed = buildNotificationFeed([notif({ id: "n1", read: false, created_at: "2026-07-01T12:00:00Z" })], [], NOW);
    expect(feedBadgeCount(feed, NOW)).toBe(0);
  });
  it("notification lida NÃO conta", () => {
    const feed = buildNotificationFeed([notif({ id: "n1", read: true, created_at: "2026-07-30T11:00:00Z" })], [], NOW);
    expect(feedBadgeCount(feed, NOW)).toBe(0);
  });
});

describe("entityIdFromUrl", () => {
  it("extrai id de /contatos, /negociacoes e query", () => {
    expect(entityIdFromUrl("/contatos/abc12345-6789")).toBe("abc12345-6789");
    expect(entityIdFromUrl("/negociacoes/def45678-9012")).toBe("def45678-9012");
    expect(entityIdFromUrl("/simulador?simulationId=5a598765-4321")).toBe("5a598765-4321");
    expect(entityIdFromUrl("/leads")).toBeNull();
    expect(entityIdFromUrl(null)).toBeNull();
  });
});
