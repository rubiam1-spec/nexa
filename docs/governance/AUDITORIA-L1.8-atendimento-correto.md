# AUDITORIA L1.8 — Atendimento correto (B1-B3) + jornada única (Partes 2-3 a seguir)

**Data:** 2026-07-10 · **Decisões:** Rubiam. Parte 1 (bugs) entregue primeiro (deploy próprio).

---

## Diagnóstico dos bugs (com evidência, `ClientDetailPage.tsx`)

**B1 — ação humana aparece como "Sistema".** A timeline funde `contact_interactions`
(gravam `performed_by`, mostram nome) + `activities`. O merge das activities
hardcodava `performed_by: null` e hora `"T12:00:00"` (linha ~715) e a query nem
selecionava `profile_id`/`created_at` — então toda atividade humana caía em
`profile?.name || "Sistema"`. O performer real (`activities.profile_id`) e a hora
(`created_at`) **sempre estiveram no dado**; era o display que mascarava.

**Achado:** "Registrar interação" grava DOIS registros — 1 `contact_interaction`
(registro) + 1 `activity` espelho (produção). Na timeline apareceriam duplicados.

**B2 — duplo clique cria idênticos.** Botão usava `disabled={saving}` (estado, re-render
assíncrono); duplo-clique rápido dispara 2 `onClick` antes do disable. Faltava guarda
**síncrona** (ref).

**B3 — interação em lead NEW não inicia atendimento.** O submit não tocava
`qualification_status` → lead seguia NEW → semáforo "sem resposta" piscando.

---

## Decisão + CONDIÇÕES (Opção 2 — dedupe; produção intacta)

Escolhida a **Opção 2** (após inventário mostrar que remover o espelho encolheria
produção em 4 superfícies — ver Débito §Final). O espelho **permanece** (produção
inalterada em todos os relatórios). Correção só na ficha, com estas condições:

- **(a) Performer real NO DADO.** O espelho já grava `profile_id` (performer) e
  `created_at` (hora) — trilha fiel no banco. A ficha passou a **ler o dado real**
  (mapeia `profile_id`→nome via `teamMembers`; usa `created_at`), em vez de mascarar.
  Só entrada genuinamente sem performer → "Sistema".
- **(b) Dedupe DETERMINÍSTICO por vínculo.** A interação passou a gravar
  `contact_interactions.activity_id` = id do espelho (coluna já existente, **zero DDL**).
  A timeline esconde o espelho **por vínculo** (`filterMirroredActivities`, função pura
  testada). Para espelhos **legados** (pré-L1.8, sem vínculo), heurística
  `tipo|título|dia` como **fallback documentado** (pode, em tese, esconder homônimo
  legítimo no mesmo dia — aceito só para legado).

---

## Regra nova de produto (registrada)

**Registrar CONTATO REAL** (ligação/whatsapp/visita/reunião/email) num lead **NEW**
**inicia o atendimento** na mesma operação (`registerContactInteraction` no
repositório: interaction + `qualification_change`, `performed_by` correto). **"nota"
e "follow_up" NÃO** iniciam (não são contato). Vocabulário puro em
`domain/status/leadQualification` (`isRealContactInteraction`,
`interactionStartsService`). Toast: "Interação registrada — atendimento iniciado ✓".

**Governança:** escrita da interação saiu do `.tsx` para o repositório
(`registerContactInteraction`), com `performed_by` = usuário. Guarda in-flight (ref)
aplicada aos forms da ficha: interação, follow-up, atribuir/remover responsável,
QuickActivityModal.

---

## Follow-up / próxima ação (Parte 3, base)
Já persistido: `clients.next_follow_up_at` + activity `scheduled` (tipo/hora) — fonte
do semáforo verde. Sem PARE.

---

## Validação
tsc 0 · build verde · check:contracts 9/9 · suíte **914/914** (+8: regra
inicia-atendimento, dedupe do espelho). WIP do importador fora do stage.

---

## DÉBITO FORMAL (decisão adiada, NÃO abandonada)

**Título:** Unificação interação × activity nos relatórios de produção.
**O quê:** hoje a produção é contada por `activities`. Se um dia removermos o espelho
(Opção 1), estas superfícies precisam passar a contar TAMBÉM as `contact_interactions`
de contato real, na mesma fonte de contagem, com teste de coerência:

| # | Superfície | Arquivo | Conta produção? |
|---|---|---|---|
| 1 | Relatório Individual | `relatorios/repositories/relatorioIndividualSupabaseRepository.ts` (`fetchAtividadesIndividual`) | SIM (por consultor/período) |
| 2 | Dashboard — ranking do time | `dashboard/widgets/DashboardWidgets.tsx:214` | SIM |
| 3 | Dashboard do consultor | `dashboard/pages/ConsultantDashboard.tsx:27` | SIM (mensal) |
| 4 | Reconhecimentos (gamificação) | `relacionamento/components/ReconhecimentosTab.tsx` | SIM |
| — | Central/agenda, TeamMemberPanel, Feed | (exibição, não contagem de produção) | não |

**Por que adiado:** mudança cross-cutting nas 4 superfícies; nesta rodada resolvemos o
bug de UX (B1) sem risco de encolher número de produção de ninguém.
**Data de revisão:** **2026-08-10** (reavaliar se vale unificar a fonte de contagem).

---

## Deploy (Parte 1)
Merge ff `9d33bde..1c844f0` → main. Deploy **`dpl_86vLp67SrfXnZc8SE4z5LoA5rBEL`**
READY (~50s), aliasado a `app.nexacomercial.com.br` (`aliasError: null`). Rollback
candidate anterior: `dpl_77qNE4DH` (L1.6+L1.7). Zero DDL; sem migração de dados
(coluna `activity_id` já existia). Sanidade no bundle `assets/index-CAuZdUMI.js`:
"atendimento iniciado", "Interação registrada" presentes; HTTP 200.
Registro commitado só na feat (sem push). **Partes 2-3 (funil ponta-a-ponta + Kanban
com jornada) = próximo passo.**
