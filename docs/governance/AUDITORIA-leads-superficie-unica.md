# AUDITORIA — Leads: superfície única (correção de navegação + convergência)

**Data:** 2026-07-10
**Autor da decisão:** Rubiam (produto) + arquiteto
**Origem:** bug de produção — item "Leads" do menu não navegava; ciclo de lead
paralelo em Contatos concorrendo com `/leads`.

---

## 1. Causa-raiz da navegação (com evidência de código)

**Não** era link errado, guard, nem lazy chunk. Era **rota `/leads` duplicada**
em `src/app/router/AppRouter.tsx`:

```tsx
// redirect LEGADO (definido primeiro) — VENCIA
<Route path="/leads" element={<Navigate to="/contatos?tab=leads" replace />} />
...
// página REAL (definida depois) — inalcançável
<Route path="/leads" element={<ProtectedAppPage><LeadsPage /></ProtectedAppPage>} />
```

No React Router v7, duas rotas com o **mesmo `path`** empatam em ranking e a
**ordem** decide → vencia o redirect. Efeito:

- Menu "Leads" (`AppSidebar.tsx` → `path: "/leads"`) caía no redirect e **pousava
  em `/contatos?tab=leads`** — exatamente o sintoma relatado.
- `LeadsPage` era **código morto** (nunca renderizava).
- O link "Ver Leads →" do pré-funil (`KanbanPage.tsx` → `navigate("/leads")`)
  sofria o mesmo sequestro.

Vale para todos os perfis (owner/director/manager/concierge/broker): o redirect é
anterior a qualquer permissão. `/leads` tem visibilidade `[]` (todos).

**Correção:** removida a rota-redirect legada; `/leads` passa a resolver
`LeadsPage`. Sub-rotas legadas (`/leads/novo`, `/leads/:id`) permanecem
redirecionando para Contatos (lead = cliente; detalhe/novo vivem em `/contatos`).

---

## 2. Decisão de produto — UMA superfície de leads

`/leads` é **A ÚNICA** superfície de trabalho de leads, operando sobre
`clients.qualification_status` (vocabulário em `domain/status/leadQualification`).
**Contatos** é **cadastro geral** (atributos de relacionamento), não um segundo
ciclo de lead.

**Fonte única de contagem:** qualquer número de "leads" (menu, pré-funil, Funil)
deriva de `countActiveLeads(accountId)` — filtra `qualification_status` por
`isLeadActive` (NEW/IN_SERVICE/QUALIFIED). Pré-funil e Funil já consumiam essa
fonte (`useNegotiationsBoard` → `board.prefunnel.leads`). **Proibido** contar por
`ClientStatus`.

---

## 3. Inventário — o que saiu de Contatos e para onde foi

| Item removido de Contatos | O que era | Destino |
|---|---|---|
| Abas **Leads / Qualificados / Em negociação / Convertidos / Perdidos** | Ciclo paralelo lendo `clients.status` | Removidas. A aba **"Leads"** virou **atalho** `Leads →` que navega para `/leads` |
| Botão **"Distribuir"** por linha | Rodízio **automático** via RPC `distribute_lead` | **Aposentado da UI** (decisão de Rubiam, 2026-07-10). A RPC e a config de rodízio em Configurações permanecem no banco; a atribuição na tela Leads é **manual** ("Atribuir" → `assignLead`) |
| Contagem de leads por `ClientStatus` | Contador paralelo | Removido. Fonte única = `countActiveLeads` |
| Hook `useLeadDistribution.ts` | Glue de UI do botão Distribuir (sem outro consumidor) | Arquivo removido (dead code) |

### Discrepância registrada (parada da instrução 7b)
O prompt assumia "Distribuir = `assignLead`". O código provou o contrário:
**Distribuir = rodízio automático (`distribute_lead`)**, sem equivalente na tela
Leads (que só tinha atribuição manual). Levado a Rubiam **antes** de remover.
**Decisão:** manter só o manual em `/leads`; aposentar o rodízio automático da UI
(RPC/config preservadas no banco).

### O que Contatos MANTÉM (cadastro geral / relacionamento)
Busca · +Novo contato · Importar/Exportar · Filtros (status, temperatura, origem,
responsável, período, cidade) · aba **Todos** · aba **Quentes** (temperatura =
atributo de relacionamento) · aba **Follow-up** (campo próprio `nextFollowUpAt`) ·
badge de status na linha (exibição do atributo do contato).

**Deep-link legado:** `/contatos?tab=leads` → **redirect para `/leads`** (efeito em
`ContatosPage`), fechando a última porta para a superfície antiga.

---

## 4. Validação

- `tsc -b`: 0 erro · `vite build`: verde · `check:contracts`: 9/9 ·
  suíte completa: 888/888 · eslint (arquivos tocados): 0.
- Testes de convergência (`src/modules/leads/__tests__/leadsSurface.contract.test.ts`):
  1. `/leads` declarado 1×, resolve `LeadsPage`, sem redirect legado.
  2. Contatos reconduz `?tab=leads` → `/leads`.
  3. Contatos não conta/distribui leads por `ClientStatus`; contagem canônica por
     `qualification_status`.

---

## 5. Commits

1. `fix(leads): rota /leads duplicada — remove redirect legado que sequestrava o menu`
2. `refactor(leads): Contatos deixa de hospedar ciclo de lead — superfície única em /leads`

WIP do importador (21 arquivos) permaneceu **fora do stage**.

---

## 6. Deploy — dump pré-merge

**Decisão (Rubiam, 2026-07-10):** o dump `ef19401` (clients + contact_interactions)
é **aceito como suficiente**. Justificativa: este deploy é **100% código** — zero
DDL, zero migração de dado; as tabelas do fluxo comercial não são tocadas. As
mudanças são de roteamento (`AppRouter`) e de UI/convergência (`ContatosPage` +
remoção de hook de UI). A RPC `distribute_lead` e a config de rodízio permanecem
intactas no banco. Logo, não há estado de banco novo a proteger além do já dumpado.

Merge: `git push origin feat/atividades-mobile-onda1:main` (fast-forward, sem
squash), levando **apenas** os 2 commits temáticos acima. Deploy Vercel via
git-integration. Sanidade: `/leads` responde, navegação do menu, redirect
`/contatos?tab=leads → /leads` em https://app.nexacomercial.com.br.
