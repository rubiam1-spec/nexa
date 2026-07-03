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
| 2 — CHECK constraints de status (dados já canônicos, sem normalização) | ✅ | `7c8063c` |
| 3 — Remover tolerância de leitura (Kanban) | ✅ | `67c5bec` |
| 4 — Teste de contrato enum × banco (check:contracts) | ✅ | `065a417` |
| 5 — Fechar funil de escrita (tudo via repositório) | ⏳ | |
| 6 — Padronizar feedback de erro | ⏳ | |
| 7 — Dinheiro fecha no centavo | ⏳ | |
| 8 — Unificar permissões | ⏳ | |
| 9 — Deploy a partir do git (fim do stash dance) | ✅ | `docs/governance/DEPLOY.md`; **feat→main via fast-forward `19b3acb..14f0fb8`** (hashes preservados); push de `main` disparou deploy de produção **`source: git`** (`dpl_GD7b9iE...`), aliasado a `app.nexacomercial.com.br` → **Production Branch=main confirmado na prática**. WIP não entrou (git build ignora não-commitado). |

**Pendências operacionais resolvidas (2026-07-02):**
- **Branch alinhada:** `main` agora = `14f0fb8` (todo o trabalho validado, ff sem squash). Produção passou a sair do git. Live anterior era `dec6264`; o novo deploy é `dec6264` + Etapa 1 (refactor de status validado) — passo à frente, não regressão. WIP do importador segue não-commitado, fora do merge e do deploy.
- **Edge functions M11 deployadas** no Supabase (`daily-briefing`, `intelligence-alerts`) via `supabase functions deploy ... --no-verify-jwt` — subidas do arquivo commitado em disco, correspondem ao código de `main`.
- **Plano da org = FREE** (confirmado via API; não Pro). Sem backup diário/PITR → dump manual feito antes do DDL da Etapa 2 (`supabase/backups/`). Doc de contexto `.claude/agents/nexa-diagnostico.md` reforçado. Upgrade fica com o Rubiam.

**De-para (Etapa 2):** dados já 100% canônicos após a Fase 2 → **nenhuma normalização** foi necessária. CHECKs aplicados (migrations `20260702120000`/`120100`, ADD NOT VALID + VALIDATE) e provados que mordem nas 5 tabelas (proposals/reservations/reservation_requests/sales/pipeline_simulations). Backup lógico pré-DDL em `supabase/backups/20260702_module_tables_pre_etapa2.json`.

**Decisões/pendências registradas na Etapa 2:**
- **Vocabulário PT em `pipeline_simulations`** (`ativa/convertida/expirada/cancelada`): decisão consciente — o CHECK reflete o vocabulário PT já existente no banco. Unificar para EN (como as demais tabelas) é **limpeza futura opcional** e deve ser feita **isolada** (migration própria de rename + backfill + atualização de src/domain/status/pipelineSimulation.ts), **nunca embutida** em outra mudança.
- **`unit_queue_entries` — CHECK ADIADO para a Etapa 5.** Motivo: o fix M1 (`usePipelineActions.promoteQueueFirst`) grava em UPPER (`ACTIVE`/`PROMOTED`) enquanto o dado/canônico são lowercase (`waiting`), e há ambiguidade semântica `WAITING` vs `ACTIVE`. Rotear a escrita pelo repositório (Etapa 5) normaliza o case; só então adicionar o CHECK, senão o próprio código geraria violação.
- **Item de ação — importador/`sales`:** a escrita principal de `sales` virá do **importador (WIP)**. Ele **DEVE** derivar o status de `src/domain/status/sale.ts` (`SaleStatus`/`SaleDbStatus`). Se gravar literal fora de `{created, awaiting_documents, awaiting_contract, awaiting_payment, completed, cancelled}`, nascerá violando `sales_status_check`. Nota replicada como comentário na migration `20260702120000`. **Aplicar quando o WIP do importador aterrissar.**

## Etapa 3 — tolerância removida + achados reportados (2026-07-03)
- **Removida** a leitura tolerante da Fase 2 no caminho do Kanban (`useKanbanData`, `KanbanPage.getEstagio` + diálogo de cancelamento + botões Aprovar, filtro de leitura do `usePipelineActions`). Comparação agora estrita contra `src/domain/status/` (agrupamentos `RESERVATION_ACTIVE_DB`, `RESERVATION_TERMINAL_DB_VALUES`, `RESERVATION_REQUEST_PENDING_DB`, `PROPOSAL_CLOSED_DB_VALUES`, `PipelineSimulationStatus.ATIVA`, `NegotiationStatus`). Commit `67c5bec`. Build verde, 0 TS, 603 testes.
- **Exceção `unit_queue` mantida** (comentada em `src/domain/status/unitQueue.ts`): o fix M1 ainda grava status de fila em UPPER; a tolerância da fila só cai na **Etapa 5** junto com o fix de escrita + o CHECK da fila.
- **⚠️ Tolerância pré-existente ENCONTRADA e NÃO removida (aguarda decisão do Rubiam)** — não foi introduzida na Fase 2, e removê-la é amplo/arriscado:
  - `src/shared/utils/normalizeStatus.ts` — `normalizeNegotiationStatus` com aliases PT/EN (`em_andamento→IN_PROGRESS`, `vendida→WON`, `perdida→LOST`, `cancelada→CANCELLED`, lowercase→UPPER). Usado por Central (`CentralPage`, `CentralMobile`, `useCentral`), relatórios e dashboards. É a normalização de leitura de negociação em todo o app.
  - `src/shared/hooks/useCadenceAlerts.ts` — filtros `.in("status", ["IN_PROGRESS","OPEN","in_progress","open"])` (negociações) e `.in("status", ["ativa","active"])` (reservas).
  - **Recomendação:** tornar estritos numa etapa própria (ou dentro da 5), com teste dedicado — não embutir aqui. `NegotiationDetailPage.tsx:1661` tem `=== "ACTIVE"` (literal solto) mas é arquivo do WIP importador — corrigir quando o WIP aterrissar.
- **Fora de escopo (não tocado):** tolerância de `unitStatus` (`vendido`/`reservado`) no `getEstagio` — units não está na lista de tabelas da Etapa 3.

## Etapa 4 — contrato enum × banco (2026-07-03)
- **Teste:** `src/domain/status/__contracts__/contracts.test.ts` prova, por tabela com CHECK, que os valores canônicos de `src/domain/status/` == o conjunto aceito pela constraint. 7 tabelas cobertas (negotiations, proposals, reservations, reservation_requests, sales, pipeline_simulations, **+ simulation_groups**, que também tem CHECK). `unit_queue` sem CHECK → só consistência interna + TODO Etapa 5. Commit `065a417`. `check:contracts` 8/8, suíte 794.
- **Abordagem escolhida = manifesto estático** (`__contracts__/db-constraints.ts`), não parsing de migration. **Justificativa:** a CHECK de `negotiations` resulta de múltiplas migrations (create + `normalize_negotiation_status_uppercase`) e o formato varia (`IN(...)` nas migrations da Etapa 2, `ANY(ARRAY[...])` nas antigas) — um parser precisaria resolver precedência multi-migration + múltiplos formatos, mais frágil que um manifesto revisado.
- **📌 REGRA DE MANUTENÇÃO DO CONTRATO (governança):** toda migration que **criar/alterar** um `*_status_check` **DEVE** atualizar o array correspondente em `src/domain/status/__contracts__/db-constraints.ts` **no mesmo commit**. Senão o `check:contracts` (na suíte padrão) falha. Regra também no header do arquivo.
- **Prova de mordida:** alterar um valor de enum fez o teste falhar com mensagem `soNoCodigo/soNoBanco` clara (revertido, não commitado).

### Pendências do importador (WIP) — itens de ação para quando aterrissar
- **`sales`:** o importador DEVE derivar o status de `src/domain/status/sale.ts` (senão viola `sales_status_check`). Nota também na migration `20260702120000`.
- **Bug latente `NegotiationDetailPage.tsx:1661`** (arquivo do WIP): `reservation.status === "ACTIVE"` (literal MAIÚSCULO) contra `reservations`, cujo canônico é `active` **minúsculo**. Como a ficha lê pelo repositório (que normaliza para o enum UPPER `ReservationStatus.ACTIVE`), hoje o ramo funciona por acaso — MAS é um literal solto e frágil. **Corrigir para `ReservationStatus.ACTIVE` (fonte única) quando o WIP aterrissar** consumindo `src/domain/status/`.

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
