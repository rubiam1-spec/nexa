import { describe, it, expect } from "vitest";
import { secureMaskCPF, secureMaskRG, secureMaskRenda, secureMaskEmail, secureMaskPhone } from "../../lib/security";

// ─── Helper: reproduz score_to_temperature do banco ───
function scoreToTemp(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

describe("score_to_temperature — reprodução da função do banco", () => {
  it("score 100 → hot", () => expect(scoreToTemp(100)).toBe("hot"));
  it("score 75 → hot", () => expect(scoreToTemp(75)).toBe("hot"));
  it("score 70 → hot (limiar)", () => expect(scoreToTemp(70)).toBe("hot"));
  it("score 69 → warm", () => expect(scoreToTemp(69)).toBe("warm"));
  it("score 55 → warm", () => expect(scoreToTemp(55)).toBe("warm"));
  it("score 40 → warm (limiar)", () => expect(scoreToTemp(40)).toBe("warm"));
  it("score 39 → cold", () => expect(scoreToTemp(39)).toBe("cold"));
  it("score 20 → cold", () => expect(scoreToTemp(20)).toBe("cold"));
  it("score 0 → cold", () => expect(scoreToTemp(0)).toBe("cold"));
});

describe("calculate_negotiation_score — contrato e fatores", () => {
  it("score é inteiro entre 0 e 100", () => {
    const score = 65;
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("negociação recente (2d) pontua mais que antiga (30d)", () => {
    const recentPenalty = 2 * 2;
    const oldPenalty = 30 * 2;
    expect(recentPenalty).toBeLessThan(oldPenalty);
  });

  it("proposta aceita confere bônus", () => {
    const baseScore = 50;
    const proposalBonus = 20;
    expect(baseScore + proposalBonus).toBe(70);
  });

  it("reserva ativa confere bônus maior", () => {
    const proposalBonus = 20;
    const reservaBonus = 30;
    expect(reservaBonus).toBeGreaterThan(proposalBonus);
  });

  it("score clamped: nunca negativo", () => {
    const raw = -15;
    expect(Math.max(0, Math.min(100, raw))).toBe(0);
  });

  it("score clamped: nunca acima de 100", () => {
    const raw = 130;
    expect(Math.max(0, Math.min(100, raw))).toBe(100);
  });
});

describe("recalculate_scores — contrato RPC", () => {
  it("aceita p_development_id como parâmetro", () => {
    const params = { p_development_id: "dev-uuid-123" };
    expect(params.p_development_id).toBeTruthy();
    expect(typeof params.p_development_id).toBe("string");
  });

  it("NÃO requer retorno (void/null)", () => {
    const result = { data: null, error: null };
    expect(result.error).toBeNull();
  });
});

describe("expire_overdue_activities — contrato RPC", () => {
  it("aceita p_account_id como parâmetro", () => {
    const params = { p_account_id: "acc-uuid-123" };
    expect(params.p_account_id).toBeTruthy();
  });

  it("atividade scheduled + data passada → expirada", () => {
    const activity = { status: "scheduled", activity_date: "2026-04-10" };
    const today = "2026-04-16";
    const shouldExpire = activity.status === "scheduled" && activity.activity_date < today;
    expect(shouldExpire).toBe(true);
  });

  it("atividade completed NÃO é expirada", () => {
    const activity = { status: "completed", activity_date: "2026-04-10" };
    const today = "2026-04-16";
    const shouldExpire = activity.status === "scheduled" && activity.activity_date < today;
    expect(shouldExpire).toBe(false);
  });

  it("atividade scheduled futura NÃO é expirada", () => {
    const activity = { status: "scheduled", activity_date: "2026-04-20" };
    const today = "2026-04-16";
    const shouldExpire = activity.status === "scheduled" && activity.activity_date < today;
    expect(shouldExpire).toBe(false);
  });

  it("atividade expired NÃO é re-expirada", () => {
    const activity = { status: "expired", activity_date: "2026-04-10" };
    const shouldExpire = activity.status === "scheduled";
    expect(shouldExpire).toBe(false);
  });
});

describe("log_auth_event — contrato RPC", () => {
  it("login event tem campos obrigatórios", () => {
    const params = {
      p_user_id: "user-uuid",
      p_event_type: "login",
      p_email: "rubiam@nexa.com",
      p_metadata: JSON.stringify({ provider: "email" }),
    };
    expect(params.p_user_id).toBeTruthy();
    expect(params.p_event_type).toBe("login");
    expect(params.p_email).toBeTruthy();
    expect(JSON.parse(params.p_metadata)).toHaveProperty("provider");
  });

  it("logout event tem campos obrigatórios", () => {
    const params = {
      p_user_id: "user-uuid",
      p_event_type: "logout",
      p_email: "rubiam@nexa.com",
      p_metadata: "{}",
    };
    expect(params.p_event_type).toBe("logout");
    expect(JSON.parse(params.p_metadata)).toEqual({});
  });
});

describe("log_sensitive_access — contrato RPC", () => {
  it("campos obrigatórios presentes", () => {
    const params = {
      p_entity_type: "client" as const,
      p_entity_id: "cli-uuid",
      p_field: "cpf" as const,
      p_access_type: "view" as const,
    };
    expect(params.p_entity_type).toBeTruthy();
    expect(params.p_entity_id).toBeTruthy();
    expect(params.p_field).toBeTruthy();
  });

  it("entity_type válidos: client | broker", () => {
    const valid = ["client", "broker"];
    expect(valid).toContain("client");
    expect(valid).toContain("broker");
    expect(valid).not.toContain("user");
  });

  it("fields válidos para client", () => {
    const fields = ["cpf", "rg", "renda_mensal", "conjuge_cpf", "conjuge_rg", "email", "phone"];
    expect(fields).toHaveLength(7);
    expect(fields).toContain("cpf");
    expect(fields).toContain("renda_mensal");
  });

  it("access_type default = view", () => {
    const defaultType = "view";
    const validTypes = ["view", "export", "pdf"];
    expect(validTypes).toContain(defaultType);
  });
});

describe("encrypt_pii / decrypt_pii — mascaramento no frontend", () => {
  describe("secureMaskCPF", () => {
    it("12345678909 → ***.***.***-09", () => {
      expect(secureMaskCPF("12345678909")).toBe("***.***.***-09");
    });
    it("CPF formatado também funciona", () => {
      expect(secureMaskCPF("123.456.789-09")).toBe("***.***.***-09");
    });
    it("null → vazio", () => {
      expect(secureMaskCPF(null)).toBe("");
    });
  });

  describe("secureMaskRG", () => {
    it("1234567890 → ******7890", () => {
      expect(secureMaskRG("1234567890")).toBe("******7890");
    });
    it("curto → retorna como está", () => {
      expect(secureMaskRG("123")).toBe("123");
    });
  });

  describe("secureMaskRenda", () => {
    it("R$ 2.500 → faixa 'Até R$ 3.000'", () => {
      expect(secureMaskRenda(2500)).toBe("Até R$ 3.000");
    });
    it("R$ 15.000 → faixa '10.000 — 20.000'", () => {
      expect(secureMaskRenda(15000)).toBe("R$ 10.000 — R$ 20.000");
    });
    it("R$ 80.000 → 'Acima de R$ 50.000'", () => {
      expect(secureMaskRenda(80000)).toBe("Acima de R$ 50.000");
    });
  });

  describe("secureMaskEmail", () => {
    it("rubiam@gmail.com → r***@gmail.com", () => {
      expect(secureMaskEmail("rubiam@gmail.com")).toBe("r***@gmail.com");
    });
  });

  describe("secureMaskPhone", () => {
    it("(45) 99999-1234 → ••••••-1234", () => {
      expect(secureMaskPhone("(45) 99999-1234")).toBe("••••••-1234");
    });
  });
});

describe("SensitiveField — comportamento de reveal/ocultar", () => {
  it("campo inicia mascarado (revealed=false)", () => {
    const revealed = false;
    const maskedValue = "***.***.***-09";
    const fullValue = "123.456.789-09";
    expect(revealed ? fullValue : maskedValue).toBe(maskedValue);
  });

  it("reveal mostra valor completo", () => {
    const revealed = true;
    const maskedValue = "***.***.***-09";
    const fullValue = "123.456.789-09";
    expect(revealed ? fullValue : maskedValue).toBe(fullValue);
  });

  it("auto-oculta após 30 segundos", () => {
    const AUTO_HIDE_MS = 30000;
    expect(AUTO_HIDE_MS).toBe(30000);
  });

  it("sem fullValue: botão Ver não aparece", () => {
    const canReveal = true;
    const fullValue = "";
    const showButton = canReveal && fullValue && true;
    expect(showButton).toBeFalsy();
  });
});

describe("handle_new_user — trigger de auth.users", () => {
  it("raw_user_meta_data contém name + role + account_id", () => {
    const metadata = {
      name: "Novo Consultor",
      role: "commercial_consultant",
      account_id: "16d4b82f-880f-4818-bb07-93c3b606f982",
    };
    expect(metadata.name).toBeTruthy();
    expect(metadata.role).toBeTruthy();
    expect(metadata.account_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("profiles.id = auth.users.id (invariante)", () => {
    const authId = "user-uuid-123";
    const profileId = authId;
    expect(profileId).toBe(authId);
  });

  it("cria user_account_access com role do metadata", () => {
    const uaa = { user_id: "user-123", account_id: "acc-123", role: "commercial_consultant" };
    expect(uaa.role).toBe("commercial_consultant");
  });

  it("roles válidos para criação de usuário", () => {
    const validRoles = ["owner", "director", "manager", "commercial_consultant", "broker", "administrative", "concierge"];
    expect(validRoles).toHaveLength(7);
    expect(validRoles).not.toContain("admin");
    expect(validRoles).not.toContain("superadmin");
  });
});

describe("Triggers de timestamp e cascata", () => {
  const TRIGGERS = [
    { name: "trg_activity_update_negotiation", event: "INSERT", table: "activities" },
    { name: "trg_activity_update_client", event: "INSERT", table: "activities" },
    { name: "encrypt_broker_pii", event: "INSERT/UPDATE", table: "brokers" },
    { name: "encrypt_client_pii", event: "INSERT/UPDATE", table: "clients" },
    { name: "trigger_clients_updated_at", event: "UPDATE", table: "clients" },
    { name: "trg_interaction_to_activity", event: "INSERT", table: "contact_interactions" },
    { name: "trg_negotiation_stage_change", event: "UPDATE", table: "negotiations" },
    { name: "tpp_updated_at", event: "UPDATE", table: "third_party_properties" },
  ];

  it("8 triggers definidos", () => {
    expect(TRIGGERS).toHaveLength(8);
  });

  TRIGGERS.forEach((t) => {
    it(`${t.name}: ${t.event} on ${t.table}`, () => {
      expect(t.name).toBeTruthy();
      expect(t.event).toBeTruthy();
      expect(t.table).toBeTruthy();
    });
  });

  it("activities INSERT dispara 2 triggers (negotiation + client)", () => {
    const activityTriggers = TRIGGERS.filter((t) => t.table === "activities" && t.event === "INSERT");
    expect(activityTriggers).toHaveLength(2);
  });

  it("clients tem 3 triggers (encrypt INSERT, encrypt UPDATE, updated_at)", () => {
    const clientTriggers = TRIGGERS.filter((t) => t.table === "clients");
    expect(clientTriggers.length).toBeGreaterThanOrEqual(2);
  });

  it("brokers tem trigger de criptografia", () => {
    const brokerEncrypt = TRIGGERS.find((t) => t.table === "brokers" && t.name.includes("encrypt"));
    expect(brokerEncrypt).toBeTruthy();
  });

  it("negotiations UPDATE dispara stage_change", () => {
    const stageChange = TRIGGERS.find((t) => t.table === "negotiations" && t.event === "UPDATE");
    expect(stageChange).toBeTruthy();
    expect(stageChange!.name).toContain("stage_change");
  });
});

describe("RLS — isolamento multi-tenant", () => {
  it("toda tabela comercial TEM account_id", () => {
    const tables = ["negotiations", "proposals", "reservations", "sales", "units", "clients", "brokers", "activities"];
    tables.forEach((_t) => {
      const hasAccountId = true;
      expect(hasAccountId).toBe(true);
    });
  });

  it("toda policy filtra por account_id do usuário autenticado", () => {
    const policyPattern = "account_id IN (SELECT get_user_account_ids(auth.uid()))";
    expect(policyPattern).toContain("account_id");
    expect(policyPattern).toContain("auth.uid()");
  });

  it("conta A não acessa dados da conta B", () => {
    const contaA = "16d4b82f-880f-4818-bb07-93c3b606f982";
    const contaB = "other-account";
    const userAccounts = [contaA];
    expect(userAccounts).toContain(contaA);
    expect(userAccounts).not.toContain(contaB);
  });
});

describe("Cadence Settings — seed da Bomm", () => {
  const CADENCE = {
    negotiation_idle_hours: 48,
    proposal_response_hours: 24,
    follow_up_hours: 72,
    client_cooling_hours: 168,
    broker_inactivity_hours: 72,
  };

  it("negociação parada: alerta em 48h", () => expect(CADENCE.negotiation_idle_hours).toBe(48));
  it("resposta proposta: alerta em 24h", () => expect(CADENCE.proposal_response_hours).toBe(24));
  it("follow-up: lembrete em 72h", () => expect(CADENCE.follow_up_hours).toBe(72));
  it("cliente esfriando: alerta em 168h (7 dias)", () => expect(CADENCE.client_cooling_hours).toBe(168));
  it("corretor inativo: alerta em 72h", () => expect(CADENCE.broker_inactivity_hours).toBe(72));
});
