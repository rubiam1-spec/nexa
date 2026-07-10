# AUDITORIA L1.7 — Atribuição inteligente + feedback de ação (sem reload)

**Data:** 2026-07-10 · **Decisões:** Rubiam. Dois bugs de UX reais na tela /leads.

---

## Diagnóstico (Parte 1, com evidência)

**PROBLEMA 1 — modal "Atribuir" plano/desordenado.** A lista vinha de `useLeads`
→ `members`, um join `user_account_access × profiles(id,name)` **sem filtro de
papel, sem ordenação, sem agrupamento, sem carga** — misturava todos os roles.
Schema (via MCP): broker→imobiliária = `brokers.brokerage_id` (+ `brokerage_name`
denormalizado); identidade atribuível = `brokers.profile_id` (clients.assigned_to
referencia profiles.id). Corretor sem `brokerage_id` = Independente.

**PROBLEMA 2 — "Iniciar" recarrega e o lead some.** NÃO é `location.reload()`.
É `useLeads.ts` — todo `refresh()` (chamado após cada ação) fazia `setLoading(true)`,
e como `LeadsPage` tem `if (loading) return <Carregando…/>`, a **lista inteira
desmontava** (tela de loading), perdia scroll e o container de toast; o lead, já
movido NEW→IN_SERVICE, reaparecia fora do filtro "sem explicação".

---

## Decisões de produto (Rubiam, 2026-07-10)

- **Elegíveis a RECEBER lead por padrão:** `manager`, `commercial_consultant`
  (equipe interna) + `broker` (corretores). `director`/`concierge`/`administrative`
  ocultos por padrão; link **"mostrar todos os papéis"** revela para exceções.
- **"Corretores" = brokers com `profile_id`** (identidade atribuível). Mantém o
  modelo atual (`clients.assigned_to = profile_id`) — zero mudança de escrita.
  (Inventário havia levantado a alternativa de usar `broker_id`; **descartada** por
  decisão do Rubiam.)

---

## Parte 2 — Atribuição inteligente (código)

- **Repositório:** `getAssignableMembers(accountId)` — 3 queries **batch (sem N+1)**:
  membros com profile (papel), brokers (brokerage), e CARGA (nº de leads
  NEW/IN_SERVICE por `assigned_to`). Retorna `{id,name,role,brokerageId,
  brokerageName,activeLeads}`.
- **Regra fora do .tsx:** `modules/leads/assignmentGrouping.ts` (PURO, testado) —
  `groupAssignableMembers(members, showAll)` → equipe interna (alfabética) +
  corretores agrupados por imobiliária (Independentes por último) + `hiddenCount`.
  `brokerageOptions` para o seletor.
- **Modal redesenhado:** 2 grupos ("Equipe interna", "Corretores" com **seletor de
  imobiliária** — Todas default), **busca única no topo varre todos** (ignora
  filtro/grupo), **carga por linha** ("N ativos"), "mostrar todos os papéis". Ao
  confirmar: modal fecha, toast "Lead atribuído a {nome} ✓", linha atualiza no
  lugar (sem reload).

---

## Parte 3 — Feedback de ação (nada some sem explicar)

- **Fim do reload:** `useLeads` só usa loading full-screen na PRIMEIRA carga de cada
  conta (`initialLoadedRef`); refetch pós-ação é **silencioso**. Ações aplicam
  **patch OTIMISTA no lugar** (`patchRow`) — o lead recebe o novo estado
  instantaneamente; o refresh silencioso reconcilia.
- **LeadsPage:** lead recém-movido para FORA do chip ativo é **mantido visível** com
  destaque (borda sprout) + nota "✓ movido para …" até a próxima interação (troca de
  chip limpa). Contadores dos chips atualizam na hora (derivam de `counts`).
- Vale para Iniciar ("movido para Em atendimento"), Qualificar ("movido para
  Qualificados") e Descartar ("Descartado — ver em Descartados"). Semáforo "parado"
  após atendimento.

---

## Validação
tsc 0 · build verde · check:contracts 9/9 · suíte **906/906** (+8: agrupamento/
elegibilidade, patch otimista sem reload, feedback). eslint: erros **pré-existentes**
(`Date.now()` em render no funil; `setState` em effect no `useLeads` original) — não
introduzidos por este ciclo; código novo limpo. WIP do importador fora do stage.

## Deploy (L1.6 + L1.7 juntos, autorizado por Rubiam)
- Merge ff `b663f40..9d33bde` → main (11 commits: L1.6 5 + reconciliação 1 + L1.7 3
  + AUDITORIAs). WIP (22 arquivos) intacto.
- Deploy **`dpl_77qNE4DHqcPubWUqRyLD58FHGnUt`** — READY (~60s), aliasado a
  `app.nexacomercial.com.br` (`aliasError: null`). Rollback candidate anterior:
  `dpl_4KUYej8y` (L1.5, b663f40).
- Dump extra: coberto — zero DDL; a única mutação (reconciliação) já dumpada
  (`dump-L1.6-...json`) e executada.
- Sanidade no bundle de produção `assets/index-D-yPwYBu.js`: presentes "Equipe interna",
  "mostrar todos os papéis" (modal agrupado), "movido para Em atendimento",
  "Descartado — ver em Descartados" (feedback), "jornada do lead", "Leads → Neg."
  (funil), "Abrir a tela de Leads" (clareza). Domínio HTTP 200.
- Este registro commitado só na feat (sem push) para não disparar rebuild redundante.

## Pendências / próximos passos
- **Fiação do bloco Origem** (`NegotiationOriginLineage`) na ficha
  `NegotiationDetailPage` — DIFERIDA até o WIP do importador assentar (1 linha).
- Filtro de Status (ClientStatus) em Contatos: mantido; candidato a revisão futura.
- Verificação logada final (clique no menu/modal/Iniciar) por Rubiam — auth-gated,
  não verificável sem sessão.
