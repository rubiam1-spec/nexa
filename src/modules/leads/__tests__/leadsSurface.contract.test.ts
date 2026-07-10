// Contrato de CONVERGÊNCIA de Leads: uma única superfície de trabalho (/leads).
// Estes testes travam três regressões concretas que já ocorreram em produção:
//   1. Navegação: rota /leads duplicada — um redirect legado sequestrava o menu.
//   2. Deep-link: o link antigo /contatos?tab=leads precisa recair em /leads.
//   3. Contagem única: Contatos não pode voltar a contar "leads" por ClientStatus.
// São invariantes de fonte (mesmo espírito de __contracts__/db-constraints.ts):
// determinísticos e baratos, guardando exatamente o que quebrou.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

const APP_ROUTER = read("src/app/router/AppRouter.tsx");
const CONTATOS = read("src/modules/contatos/pages/ContatosPage.tsx");
const CLIENTS_REPO = read("src/infra/repositories/clientsSupabaseRepository.ts");

describe("Convergência de Leads — navegação (causa-raiz do bug)", () => {
  it("declara a rota raiz /leads exatamente uma vez", () => {
    const matches = APP_ROUTER.match(/path="\/leads"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("a rota /leads resolve LeadsPage, não um redirect", () => {
    expect(APP_ROUTER).toMatch(/path="\/leads"\s+element=\{<ProtectedAppPage><LeadsPage/);
  });

  it("não existe mais o redirect legado /leads → /contatos?tab=leads", () => {
    expect(APP_ROUTER).not.toContain('to="/contatos?tab=leads"');
  });
});

describe("Convergência de Leads — deep-link legado", () => {
  it("Contatos reconduz ?tab=leads para /leads", () => {
    expect(CONTATOS).toMatch(/qp\.get\("tab"\)\s*===\s*"leads"/);
    expect(CONTATOS).toMatch(/navigate\("\/leads"/);
  });
});

describe("Convergência de Leads — superfície e contagem únicas", () => {
  it("Contatos não conta/filtra leads pelo ClientStatus paralelo", () => {
    // O trio que alimentava a aba 'Leads' paralela não pode reaparecer.
    expect(CONTATOS).not.toContain('["new", "contacted", "qualifying"]');
  });

  it("Contatos não hospeda mais a distribuição (rodízio) de leads", () => {
    expect(CONTATOS).not.toContain("useLeadDistribution");
    expect(CONTATOS).not.toContain("Distribuir");
  });

  it("a contagem canônica de leads deriva de qualification_status", () => {
    expect(CLIENTS_REPO).toMatch(/export async function countActiveLeads/);
    expect(CLIENTS_REPO).toMatch(/isLeadActive\(fromLeadQualificationDb/);
  });
});
