# AUDITORIA — Módulo de Negociações (NEXA)

> Fase 1 concluída em 2026-07-02. Varredura de dados + repositórios/hooks + UI + simulador + edge functions.
> Supabase project `phpbsiyxwsbzeevqgixk`. Constraints/dados confirmados direto no banco (os `docs/database/*.sql` estão **desatualizados** — não usar como fonte de verdade).
> Correção crítica de status já aplicada antes desta auditoria: commit `372a2c1` (negotiations.status em UPPERCASE).

## Verdade do banco (referência para os fixes)

| Tabela | CHECK de status? | Valores reais / default | Dados em prod |
|---|---|---|---|
| `negotiations` | ✅ | `OPEN,IN_PROGRESS,PROPOSAL,RESERVATION,WON,LOST,CANCELLED` (UPPER) | só `IN_PROGRESS` |
| `proposals` | ❌ nenhum | repo usa lowercase EN (`draft…`) | `under_analysis` |
| `reservations` | ❌ nenhum | repo usa lowercase EN (`active/converted/cancelled`) | `active` |
| `reservation_requests` | ❌ nenhum | repo usa lowercase EN (`requested/approved`) | `approved` |
| `sales` | ❌ nenhum | repo usa lowercase EN (`awaiting_documents…`) | (vazio) |
| `unit_queue_entries` | ❌ nenhum | repo usa UPPER (`ACTIVE/PROMOTED/CANCELLED`) | (vazio) |
| `pipeline_simulations` | ❌ nenhum | default `'ativa'` (PT); Kanban filtra `["ativa","draft"]` | `ativa`(4)+`converted`(5) |
| `simulation_groups` | ✅ | `active,converted,expired,cancelled` (EN); default `active` | (vazio) |

**Direção canônica (ancorada nos dados reais):** o vocabulário dos **repositórios** é a fonte de verdade — proposals/reservations/reservation_requests/sales em **inglês minúsculo**; unit_queue em **UPPER**; negotiations em **UPPER**; pipeline_simulations em **PT (`ativa`)**. Quem diverge é o `usePipelineActions.ts` (grava PT/UPPER onde o resto lê EN/lower).

**RLS:** ✅ sólida nas 14 tabelas do módulo (SELECT/INSERT/UPDATE/DELETE filtram `account_id` via `user_account_access`). Zero advisor de "missing RLS". Integridade referencial limpa (0 órfãos de FK).

---

## 🔴 CRÍTICO — quebra fluxo ou corrompe/vaza dado

### C1. Vocabulário de status divergente entre pipeline e repositórios (guarda-chuva)
`usePipelineActions.ts` grava as mesmas tabelas com valores que o resto do app lê como fallback. Como essas tabelas **não têm CHECK**, não estoura — corrompe silenciosamente a leitura.
- **Propostas** — `usePipelineActions.ts:33` grava `"DRAFT"`, `:219` grava `"REJECTED"` e filtra `["DRAFT","SENT","UNDER_ANALYSIS"]`; `:25` compara `=== "DRAFT"`. Banco/repo usam lowercase (`draft/sent/under_analysis/rejected`; prod tem `under_analysis`). → Re-abrir/rejeitar em cascata nunca casa; propostas do detalhe (`draft`) somem do filtro do pipeline. **Fix:** gravar/filtrar lowercase.
- **Solicitação de reserva** — `usePipelineActions.ts:68` grava `"pending"`, `:220` filtra. Repo usa `requested/approved` (prod tem `approved`). **Fix:** gravar `"requested"`.
- **Reservas** — `usePipelineActions.ts:98,135,224` grava PT `"ativa"/"convertida"/"cancelada"`; `useKanbanData.ts:64` filtra `["ativa","ACTIVE"]`. Repo grava/lê `active/converted/cancelled` (prod tem `active`). → Reserva do detalhe (`active`) não casa com a cascata do pipeline → **cancelar não libera a unidade**. **Fix:** padronizar em `active/converted/cancelled`.
- **Vendas** — `usePipelineActions.ts:131` grava PT `"aguardando_documentacao"`; repo lê `awaiting_documents` → cai em fallback `CREATED`. O gate de documentos (`useSales.ts:160,179`, testa `AWAITING_DOCUMENTS`) **nunca dispara**. **Fix:** gravar `"awaiting_documents"`.
> Alternativa mais limpa: rotear essas escritas pelos repositórios (`createReservationRequest`/`createSale`/repos), em vez de `supabase.from(...).insert` cru no hook.

### C2. Itens de grupo multi-unidade ficam invisíveis no pipeline
`SimuladorPage.tsx:832` insere itens extras em `pipeline_simulations` com `status:"active"`, mas o Kanban filtra `.in("status",["ativa","draft"])` (`useKanbanData.ts:96`). Unidades adicionais do grupo **nunca aparecem** no pipeline. **Fix:** trocar `"active"`→`"ativa"` na linha 832.

### C3. ~~Vazamento~~ registros sem empreendimento aparecem em todos — **INTENCIONAL**
`useKanbanData.ts:49,97` filtra `development_id.eq.<X>,development_id.is.null`. **Resolução (Rubiam, 2026-07-02):** é intencional — negociações/simulações sem empreendimento devem aparecer em qualquer empreendimento da conta. **Não é bug**; filtro mantido.

---

## 🟡 MÉDIO — comportamento errado mas contornável

### M1. Promoção de fila referencia status/coluna inexistentes
`usePipelineActions.ts:205-209` filtra `.eq("status","waiting")` e faz `update {status:"promoted", promoted_at:…}`. `unit_queue_entries` usa `ACTIVE/PROMOTED/CANCELLED` e **não tem coluna `promoted_at`**. → Ninguém é promovido quando uma unidade é liberada. **Fix:** filtrar `"ACTIVE"`, gravar `"PROMOTED"`, remover `promoted_at`.

### M2. `pipeline_simulations.status` com idiomas misturados
Insert grava `"ativa"` (PT), conversão grava `"converted"` (EN) (`usePipelineActions.ts:188`). Sem CHECK → convive, mas relatórios/consultas por status ficam não confiáveis (prod já tem 4 `ativa` + 5 `converted`). **Fix:** padronizar (`"ativa"`/`"convertida"` PT) + adicionar CHECK depois de normalizar os dados. Considerar backfill dos 5 `converted`→`convertida`.

### M3. Arredondamento de parcelas/balão não fecha o total
`useSimulador.ts:184` (`saldoFinanciar/numeroParcelas` em float) e `:167` (balão) sem arredondar a centavos; `parcelas_valor` gravado assim (`SimuladorPage.tsx:221`). `qtd × valor ≠ saldo`. A tolerância de R$1 (`:193`) mascara. **Fix:** arredondar 2 casas e lançar o resíduo na última parcela; reduzir tolerância p/ `< 0.01`.

### M4. Erros de escrita engolidos sem mensagem em PT
- Simulador grupo: `SimuladorPage.tsx:833,853,854` (`.then(()=>{},()=>{})`) → "Simulação salva" mesmo perdendo o grupo.
- Ficha: "marcar perdida" `NegotiationDetailPage.tsx:1821` (só `console.error`); "trocar corretor" `:920,922` (`catch { /* ignore */ }`); reserva automática pós-aceite `:613`.
- `usePipelineActions.ts:11` `logActivity` engole falha de auditoria (contraria CLAUDE.md §12).
- `useKanbanData.ts:101,108`.
**Fix:** capturar erro, `console.error` do erro real e toast/estado em PT.

### M5. Erro exibido como sucesso / `alert()` nativo no Kanban
`KanbanPage.tsx:630` `celebrate(e.message)` mostra erro em toast verde; `:369,497,612` usam `alert()` nativo. **Fix:** canal de erro/toast padrão em PT.

### M6. Campos de formulário descartados na ficha
- Textarea "Observação" da solicitação de reserva sem `value/onChange` (`NegotiationDetailPage.tsx:2239-2242`) → texto perdido.
- Input "Personalizado" de parcelas fixo em `value=""` (`:2128`) → sempre em branco ao digitar.
**Fix:** ligar ao estado (ou remover o campo de observação se não persistido).

### M7. Toast de criação nunca é visto
`NegotiationsPage.tsx:153-155`: `setSuccessMsg` e logo `navigate('/negociacoes/:id')` — a lista desmonta antes de exibir. **Fix:** passar flag via `state`/searchParam e exibir o toast na ficha.

### M8. Listagem sem paginação nem busca para todos os perfis
Sem paginação (`NegotiationsPage.tsx:373`, renderiza todos os cards); busca/filtros só para gestores (`:309`); estado vazio de filtro usa o vazio de "sem dados" com CTA errado (`:369`). **Fix:** paginar/virtualizar; expor busca por cliente/unidade a broker/consultor; distinguir "sem resultado do filtro".

### M9. Permissões divergentes entre telas
`shared/utils/permissoes.ts` (Kanban) vs `app/authorization/permissions.ts` (ficha): `administrative` **não** aprova reserva no Kanban mas **aprova** na ficha (`NegotiationDetailPage.tsx:1586`). Botão aparece/some conforme a tela. **Fix:** unificar a fonte de permissão. (Requer decisão de produto: administrative pode aprovar reserva? sim/não.)

### M10. Ações do Kanban só no hover / alvos < 44px
`KanbanPage.tsx:495` (`isHovered || isMobile`) → em tablet touch (não classificado `isMobile`) botões e menu ⋮ ficam inacessíveis; `:704` (~24px) e `:298` (36px) abaixo de 44px. **Fix:** expor ações no touch; aumentar alvos.

### M11. Edge functions ignoram PROPOSAL/RESERVATION como ativas
`supabase/functions/daily-briefing/index.ts:70` e `intelligence-alerts/index.ts:67` filtram só `OPEN/IN_PROGRESS` (+variantes). Negociações em `PROPOSAL/RESERVATION` (ativas) não entram no briefing nem geram alerta de estagnação. **Fix:** incluir `PROPOSAL,RESERVATION`.

---

## 🟢 BAIXO — polish / UX / performance / higiene

- **B1.** `normalizeNegotiationStatus` do history sem cases `PROPOSAL/RESERVATION/CONVERTED` (`negotiationHistorySupabaseRepository.ts:51-81`) → só ruído de warning. Adicionar os cases.
- **B2.** Link "Pipeline" é `<a href>` e recarrega a página (`NegotiationsPage.tsx:226`) → usar `<Link>`.
- **B3.** Criação rápida de cliente sem toast (`NegotiationsPage.tsx:163-173`).
- **B4.** Código morto / fragilidade "owner": `permissions.ts` não tem chave `"owner"` (hoje protegido por normalização `owner→director`); comparações `["owner",…].includes(account.role)` (`NegotiationsPage.tsx:121`, `NegotiationDetailPage.tsx:914`) nunca casam.
- **B5.** Transições proposta/reserva/venda sem toast de sucesso (atualizam inline).
- **B6.** Edge functions com filtros de status lowercase inexistentes (inócuo, mas revela incerteza de contrato).
- **B7.** Hardening: 75 funções `SECURITY DEFINER` executáveis por anon/authenticated (advisor) — garantir que `commit_negotiation_import`/`undo_negotiation_import`/`calculate_negotiation_score` validam `account_id` internamente; `unaccent` no schema public; proteção de senha vazada desabilitada.
- **B8.** `docs/database/*.sql` desatualizados (UPPER/EN) vs banco real — atualizar ou marcar como não-normativos.
- **B9.** Dados: 2 negociações sem cliente, 1 sem unidade (colunas nullable; provavelmente third-party/import). Verificar intenção.
- **B10.** Aba "Documentos" da ficha é placeholder ("Em breve · Sprint B.3") — WIP conhecido.

---

## Fase 3 — Endurecimento estrutural (rastreio)
| Etapa | Status | Commit |
|---|---|---|
| 1 — Fonte única de vocabulário (src/domain/status/) | ✅ | `f081a4a` |
| 2 — Normalizar dados legados + CHECK constraints | ⏳ | |
| 3 — Remover tolerância de leitura | ⏳ | |
| 4 — Teste de contrato enum × banco (check:contracts) | ⏳ | |
| 5 — Fechar funil de escrita (tudo via repositório) | ⏳ | |
| 6 — Padronizar feedback de erro | ⏳ | |
| 7 — Dinheiro fecha no centavo | ⏳ | |
| 8 — Unificar permissões | ⏳ | |
| 9 — Deploy a partir do git (fim do stash dance) | ⏳ | |

**De-para legado a normalizar (Etapa 2):** `unit_queue_entries` tem 1 registro `"waiting"` (canônico repo = lowercase; ver src/domain/status/unitQueue.ts). Demais tabelas: dados já no canônico após a Fase 2 (proposals=under_analysis, reservations=active, reservation_requests=approved, pipeline_simulations=ativa/convertida, negotiations=IN_PROGRESS).

## Notas de escopo
- `src/services/negotiationImport/*` e componentes `*Import*` são **WIP não-commitado, fora de produção** — não auditados a fundo.
- Kanban de negociações **não tem drag-and-drop** (avança por botões/modais); itens do prompt sobre DnD/rollback não se aplicam ao design atual.

---

## Rastreio da Fase 2 (preencher ao corrigir)
| Item | Status | Commit |
|---|---|---|
| C1 propostas | ✅ | `7baf3bb` |
| C1 reservation_requests | ✅ | `7baf3bb` |
| C1 reservas | ✅ | `7baf3bb` |
| C1 vendas | ✅ | `7baf3bb` |
| C2 grupo multi-unidade | ✅ | `7baf3bb` |
| C3 vazamento entre empreendimentos | ✅ | não é bug — decisão de produto (intencional) |
| M1 fila promove + M2 idioma sim. (+backfill) | ✅ | `099473f` |
| M4 (pipeline/kanban) + M5 erros → toast | ✅ | `c0059b8` |
| M4 (ficha: trocar corretor) + M6 campos de form | ✅ | `8ad037d` |
| M9 administrative aprova reserva | ✅ | `8ad037d` + teste `fb988b6` |
| M11 edge functions PROPOSAL/RESERVATION | ✅ | `4a5395f` (requer deploy da função) |
| M7 toast na ficha + M8 busca/paginação | ✅ | `3935aeb` |
| M10 Kanban touch + alvos 44px | ✅ | `5a74966` |
| M3 arredondamento simulador | ✅ | `6703c6b` (exibir "última parcela" na UI = follow-up) |
| B1–B10 (🟢 polish/hardening) | ⏳ | adiados — não bloqueiam |
