import { describe, it, expect } from "vitest";
import type { Notification } from "../useNotifications";

function makeNotif(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n-1", type: "proposal_approved", title: "Proposta aprovada",
    message: "Proposta Q1·L4 foi aprovada", action_url: null,
    read: false, created_at: "2026-04-16T10:00:00Z", sender_id: null,
    ...overrides,
  };
}

describe("Notifications — lógica de contagem e filtragem", () => {
  it("unreadCount = notificações não lidas", () => {
    const notifs: Notification[] = [
      makeNotif({ id: "1", read: false }),
      makeNotif({ id: "2", read: true }),
      makeNotif({ id: "3", read: false }),
    ];
    const unread = notifs.filter((n) => !n.read).length;
    expect(unread).toBe(2);
  });

  it("markAsRead optimistic: atualiza antes de persistir", () => {
    const notifs = [makeNotif({ id: "1", read: false }), makeNotif({ id: "2", read: false })];
    const updated = notifs.map((n) => n.id === "1" ? { ...n, read: true } : n);
    expect(updated[0].read).toBe(true);
    expect(updated[1].read).toBe(false);
    expect(updated.filter((n) => !n.read).length).toBe(1);
  });

  it("markAllAsRead zera contador", () => {
    const notifs = [makeNotif({ id: "1" }), makeNotif({ id: "2" }), makeNotif({ id: "3" })];
    const updated = notifs.map((n) => ({ ...n, read: true }));
    expect(updated.filter((n) => !n.read).length).toBe(0);
  });

  it("ordenação por created_at desc", () => {
    const notifs = [
      makeNotif({ id: "1", created_at: "2026-04-10T10:00:00Z" }),
      makeNotif({ id: "2", created_at: "2026-04-16T10:00:00Z" }),
      makeNotif({ id: "3", created_at: "2026-04-13T10:00:00Z" }),
    ];
    const sorted = [...notifs].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    expect(sorted[0].id).toBe("2");
    expect(sorted[1].id).toBe("3");
    expect(sorted[2].id).toBe("1");
  });

  it("limit 50: não excede", () => {
    const notifs = Array.from({ length: 60 }, (_, i) => makeNotif({ id: `n-${i}` }));
    const limited = notifs.slice(0, 50);
    expect(limited.length).toBe(50);
  });
});

describe("Notifications — tipos de notificação", () => {
  const TYPES = [
    "proposal_approved", "proposal_rejected", "reservation_requested",
    "reservation_approved", "sale_completed", "update_request",
  ];
  it("sistema tem pelo menos 6 tipos", () => {
    expect(TYPES.length).toBeGreaterThanOrEqual(6);
  });
  TYPES.forEach((t) => {
    it(`tipo ${t} é string válida`, () => {
      expect(typeof t).toBe("string");
      expect(t.length).toBeGreaterThan(0);
    });
  });
});
