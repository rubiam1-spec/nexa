# AUDITORIA L1.6 — Reconciliação do passado · Linhagem · Funil ponta-a-ponta

**Data:** 2026-07-10 · **Decisão de produto:** Rubiam + arquiteto
**Objetivo:** o sistema EXPLICA as conexões Leads ↔ Contatos ↔ Negociações;
nada parecendo duplicado ou quebrado. Base de produção = main pós-L1.5.

---

## BLOCO 1 — Reconciliação do passado (DADOS · aguarda checkpoint humano)

### Diagnóstico (SELECT read-only via MCP, projeto NEXA `phpbsiyxwsbzeevqgixk`)
Clients com `qualification_status` ATIVO que já possuem negociação — os
"leads-fantasma" (aparecem como lead novo E como negociação):

| Cliente | client_id | qualification | negotiation_id | status neg. |
|---|---|---|---|---|
| Carla Andréia Favretto da Silva | `93d3854e-3f51-46cf-92cd-e02a9159c00a` | unqualified (NEW) | `796e1987-c794-460c-82a1-881783272ceb` | IN_PROGRESS |
| Remir José de Souza | `1853d771-5c6c-48df-bc5a-6dad23c92f4d` | unqualified (NEW) | `3fe48512-65a3-4e92-8d26-2d7f4e1ce630` | PROPOSAL |

São 2 (dos 14 `unqualified`), ambos conta `16d4b82f-880f-4818-bb07-93c3b606f982`,
relação 1:1 lead↔negociação. Pré-L1, nunca reconciliados.

### Plano de UPDATE (guardado — NÃO executado; aguarda autorização, Governança 11)
1. **Dump-alvo ANTES:** `clients` (colunas de lead) + `contact_interactions` das
   2 linhas (id acima), como salvaguarda.
2. **Em transação, idempotente** (guarda `WHERE qualification_status='unqualified'`):
   - `UPDATE clients SET qualification_status='converted', converted_at=now(),
     converted_negotiation_id=<neg> WHERE id=<client> AND qualification_status='unqualified'`.
   - `INSERT contact_interactions (type='qualification_change',
     title='Convertido em negociação — reconciliação L1.6',
     metadata={from:'NEW',to:'CONVERTED',negotiation_id:<neg>,reconciliation:'L1.6'},
     negotiation_id=<neg>)`.
   - `converted` é o valor canônico da fonte única (`domain/status/leadQualification`).
3. Estruturado como ÚLTIMO passo do ciclo. **Checkpoint:** só executa com "GO" do Rubiam.

### ✅ EXECUTADO (2026-07-10, autorizado por Rubiam)
Dump-alvo salvo em `dump-L1.6-reconciliacao-pre-update.json` (com rollback_hint).
Transação idempotente executada. Verificação pós-UPDATE:
- `fantasmas_restantes = 0`.
- Carla e Remir → `qualification_status='converted'`, `converted_negotiation_id`
  preenchido, `converted_at=2026-07-10T16:06:09Z`.
- 2 `contact_interactions` de reconciliação criadas (metadata.reconciliation='L1.6',
  coluna `negotiation_id` populada — fio da linhagem fechado).
Rollback disponível no dump (não acionado).

---

## BLOCO 2 — Linhagem do lead na negociação (código)

- **Passo 5 (fio da linhagem):** `addContactInteraction` passou a gravar a coluna
  first-class `contact_interactions.negotiation_id` (antes só ia no `metadata`).
  `transitionLead` (→ `markLeadConverted`) já propaga `negotiationId`. Zero DDL
  (coluna já existia). Também grava `clients.converted_negotiation_id` (já existente).
- **Passo 4 (bloco "Origem"):** a ficha `NegotiationDetailPage.tsx` está **em WIP
  (git status: M)** — **NÃO tocada** (Governança WIP). A linhagem foi entregue como
  **componente isolado** `components/NegotiationOriginLineage.tsx` (presentacional
  puro: canal/origin, utm_campaign, data de conversão — dados já em `clients`).
  **Fiação diferida:** quando o WIP do importador assentar, importar o componente na
  área de resumo da ficha (1 linha). **Nada se perde** — o dado e o componente existem.

---

## BLOCO 3+5 — Funil ponta-a-ponta (código)

Fonte ÚNICA de leads no board consolidada em **linhas mínimas** (`getLeadFunnelRows`
— created_at + qualification), substituindo a contagem avulsa `countActiveLeads` no
`useNegotiationsBoard`. Toda leitura é função PURA testada em `board/leadFunnel.ts`:
- `computeLeadSnapshot` → novos (NEW) · em atendimento (IN_SERVICE+QUALIFIED) ·
  ativos (= idêntico a countActiveLeads por construção). Exposto em `board.prefunnel`.
- `computeEntryConversion(rows, startMs)` → conversão de ENTRADA por coorte de
  período: convertidos ÷ leads criados no período. Sem base → `null` → UI "—".

Visão Funil ganha a seção **"Pré-funil · jornada do lead"**: Novos → Em atendimento
→ **(Leads → Neg.: X%)** → Em negociação, contínua com o funil de negociação
existente (Em negociação → Proposta → Reserva → Venda). `countActiveLeads` mantida
no repositório (contrato/testes L1.5) — sem outro consumidor.

---

## BLOCO 4 — Clareza entre telas (código)

- **Contatos (lista):** linha de contato que É lead ativo ganha atalho discreto
  **"Lead · <estágio> →"** → `/leads?q=<nome>` (busca focada). Convertido/descartado
  = sem selo (só cadastro).
- **Ficha do contato (`ClientDetailPage`, fora do WIP):** mesmo selo no header.
  Adicionado `qualification_status` ao select/tipo (zero DDL).
- **Passo 9 — resíduo removido:** o badge de `ClientStatus` ("Novo/Contatado/…") na
  lista de Contatos **saiu** (lista desktop + mobile) — era o resíduo visual do ciclo
  antigo que confundia. Componente `Badge` local e import `CLIENT_STATUS_COLORS`
  removidos. **Mantidos:** `TempBadge` (temperatura = relacionamento) e o **filtro**
  de Status no painel (ferramenta de busca, não selo de ciclo) — reportado para
  decisão futura, não removido sem aval.
- **LeadsPage:** passa a ler `?q=` para focar a busca quando aberto pelo atalho.

---

## Validação
tsc 0 · build verde · check:contracts 9/9 · suíte 898/898 (+10: leadFunnel,
linhagem). eslint: 3 erros **pré-existentes** (`Date.now()` em render no
`FunnelView`/`useNegotiationsBoard`) — não introduzidos por este ciclo; código novo
limpo. WIP do importador (22 arquivos) fora do stage.
