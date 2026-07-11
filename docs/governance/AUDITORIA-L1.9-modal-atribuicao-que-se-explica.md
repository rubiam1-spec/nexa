# AUDITORIA L1.9 — Modal de atribuição que se explica

**Data:** 2026-07-10 · **Decisão de produto:** Rubiam + arquiteto
**Objetivo:** o dropdown de imobiliárias do modal "Atribuir lead" parecia "vazio".
O sistema está **correto** (L1.7: elegível = corretor com **acesso**/profile), mas
**não explicava** por que quase nada aparece. L1.9 faz a UI **contar a história**,
sem mudar uma vírgula da elegibilidade.

---

## Diagnóstico (SELECT read-only via MCP, projeto NEXA `phpbsiyxwsbzeevqgixk`)

Verdade do banco no momento da mudança:

| Métrica | Valor |
|---|---|
| Imobiliárias (todas ativas) | **49** |
| Corretores cadastrados | **257** |
| Corretores **com** acesso (profile) | **4** |
| Corretores ativos **sem** acesso (profile null) | **253** |
| Imobiliárias com ≥1 corretor **ativo sem acesso** | **29** |
| Imobiliárias com ≥1 corretor **com acesso** (selecionáveis) | **1** |

O dropdown antigo derivava as opções só dos corretores elegíveis → mostrava **1**
imobiliária e escondia as outras 48, dando a falsa impressão de bug.

---

## BLOCO 1 — Dropdown lista TODAS as imobiliárias (código)

- **Fonte da lista:** diretório completo da conta (`brokerages` ativas), não mais
  derivado dos elegíveis. Nova função de dados `getBrokerageAssignmentContext`
  (infra) faz **2 queries em batch** (`brokerages` + `brokers`), sem N+1.
- **Regra de visibilidade (pura, fora do .tsx):** `brokerageSelectOptions`
  (`modules/leads/assignmentGrouping.ts`) recebe o agrupamento L1.7 + o diretório e
  devolve `{ id, label, disabled }`:
  - imobiliária **com** corretor ativo → selecionável;
  - imobiliária **sem** corretor ativo → **desabilitada** + sufixo
    `· sem corretores ativos`;
  - `Todas` e `Independentes` (quando há independente com acesso) sempre
    selecionáveis; ordem alfabética, `Independentes` por último.
- **Zero mudança de elegibilidade:** `groupAssignableMembers` (L1.7) **intocada**.
  Só a **visibilidade** do seletor mudou.

## BLOCO 2 — Rodapé informativo + convite (código)

- Rodapé no grupo **Corretores**:
  `N imobiliárias · M corretores cadastrados ainda sem acesso — Convidar corretores →`.
- **Contagem da fonte única, em batch:** `summarizePendingBrokers` (pura) sobre as
  linhas de `brokers` já trazidas pelo mesmo `getBrokerageAssignmentContext`.
  - **M** = corretores `status='active'` com `profile_id IS NULL` (cadastrados sem
    acesso) → hoje **253**.
  - **N** = imobiliárias **distintas** entre esses pendentes → hoje **29**.
  - Decisão de semântica: N conta as imobiliárias **com pendência** (as que o
    convite destrava), não o total (49), para as duas números contarem **uma
    história coerente e acionável**. Rótulo pluralizado em pt-BR por
    `pendingBrokersLabel` (pura); some quando não há pendência.
- **Link "Convidar corretores →"** navega para `/corretores` (superfície de convite
  **existente** — `BrokersPage`, fluxo `inviteBroker`). Nenhuma superfície nova.

## Arquitetura / camadas

- Dados (fetch) em **infra** (`clientsSupabaseRepository`); regra de
  agrupamento/contagem/rótulo em **função pura** (`assignmentGrouping`, camada
  leads); **zero regra em .tsx** — o modal só renderiza o que a função pura decide.
- Modal **compartilhado** (`/leads` e Kanban) recebe `brokerageDirectory` +
  `pendingBrokers` + `onInvite` via `useLeads`. Ambas as telas passam
  `onInvite={() => navigate("/corretores")}`.

---

## DoD

- **tsc:** 0 erros.
- **build:** verde (só warnings pré-existentes de chunk/jspdf).
- **testes:** suíte completa **928 passed**; +9 casos novos em
  `assignmentGrouping.test.ts` (dropdown completo, desabilitados, ordem,
  `Independentes`, contagem `summarizePendingBrokers`, rótulo `pendingBrokersLabel`)
  e mock de `getBrokerageAssignmentContext` em `useLeads.test.ts`.
- **WIP (22) intocado:** os 22 arquivos em andamento (import de negociações,
  sales, receive-lead, migrations, `NegotiationDetailPage`, `ROBOS-NEXA`, etc.)
  **não** entram nos commits do L1.9 (8 arquivos, disjuntos do WIP).
- **Elegibilidade:** inalterada (L1.7 preservada).

---

## INCIDENTE — "reportado concluído" sem estar em produção (2026-07-11)

**Sintoma:** Rubiam abriu o modal EM PRODUÇÃO com hard refresh (Ctrl+F5 /
Ctrl+Shift+R) e a tela estava **idêntica à L1.7** — dropdown só com
`Todas / Master Home / Independentes`, sem imobiliárias desabilitadas, sem rodapé.

**Onde o funil de entrega quebrou (diagnóstico com evidência, na ordem):**

| Passo | Verificação | Resultado |
|---|---|---|
| 1. Código existe? | `git show 611f305` | ✅ literais `· sem corretores ativos` e `Convidar corretores →` presentes no commit |
| **2. Está na `main`?** | `git log origin/main` | ❌ **QUEBROU AQUI** — os 4 commits (`5ed2a2b` deploy-doc L1.8 + `611f305/7e05510/68b793d` L1.9) não estavam na `main` |
| 3. Produção = `main`? | Vercel prod `dpl_6nf9LWUu` = `0a79ebf` | Produção seguia `main` **pré-L1.9** |
| 4. Bundle tinha o código? | (implícito) | Não — produção era `0a79ebf` |

**Causa raiz:** a L1.9 foi **commitada só na feat**; o **rito de deploy
(`push feat→main`) não foi executado**. O relatório de "concluído" se baseou em
`tsc/build/testes verdes localmente` — que provam o código, **não a entrega**.

**Correção (sem reimplementar nada):** `git push origin HEAD:main` (fast-forward
sem squash, `0a79ebf..68b793d`) → integração git da Vercel disparou o deploy →
**`dpl_8VVCFRTrgqyJT4a1AT3m32Q8eeVd` READY, target production, sha `68b793d`**,
aliasado a `app.nexacomercial.com.br`.

**Prova de bundle (FASE 3 — o que faltava):**
```
GET https://app.nexacomercial.com.br/                       → HTTP 200
GET https://app.nexacomercial.com.br/assets/index-Cs2E-76c.js → HTTP 200 (3.25 MB)
  grep "· sem corretores ativos"  → 1×
  grep "Convidar corretores"      → 1×
  minificado: var qC=`· sem corretores ativos`;function JC(e,t)…
```

**Nota de rollback:** deploy 100% código (zero DDL, query read-only). Rollback =
instant rollback para `dpl_6nf9LWUu` (`0a79ebf`) ou `git revert` do range. Não acionado.

---

## ⚖️ REGRA NOVA DE GOVERNANÇA (cânone — vale para todos os ciclos futuros)

> **Prova de bundle obrigatória.** Nenhuma entrega de **UI** pode se reportar
> **concluída** sem **prova de bundle em produção** no relatório: `grep` de um
> **literal exclusivo** da feature no JS servido pelo domínio de produção
> (`app.nexacomercial.com.br`), além do deploy `READY` com `sha == tip da main`.
>
> `tsc/build/testes verdes` provam o **código**, não a **entrega**. O funil só
> está fechado quando: **código → `main` → deploy READY aliasado → literal no bundle**.
> (Promover ao cânone central em `ROBOS-NEXA.md` quando o WIP do importador assentar
> — não tocado agora por estar em WIP.)

---

## Arquivos do L1.9 (8)

```
src/infra/repositories/clientsSupabaseRepository.ts   (getBrokerageAssignmentContext + tipos)
src/modules/leads/assignmentGrouping.ts               (brokerageSelectOptions, summarizePendingBrokers, pendingBrokersLabel)
src/modules/leads/useLeads.ts                         (fetch do contexto + expõe diretório/pendências)
src/modules/leads/LeadActionModals.tsx                (dropdown completo + rodapé)
src/modules/leads/LeadsPage.tsx                       (props + onInvite)
src/modules/negociacoes/pages/KanbanPage.tsx          (props + onInvite)
src/modules/leads/__tests__/assignmentGrouping.test.ts
src/modules/leads/__tests__/useLeads.test.ts
```
