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
| 3b — Lógica estrita + tradutor de exibição de histórico | ✅ | `fad0988` |
| 4 — Teste de contrato enum × banco (check:contracts) | ✅ | `065a417` |
| 5 — Fechar funil de escrita (tudo via repositório) + CHECK da fila | ✅ **COMPLETA** (Bloco 1 `6e273a7` + Bloco 2 `20260703121000`/`121100` + **5c: funil global**) | ver "Etapa 5 — Bloco 1/2/5c" |
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

## Etapa 5c — funil de escrita GLOBAL: 6 superfícies via repositórios (2026-07-03) — AUTORIZADO pelo Rubiam
**Objetivo:** eliminar TODA escrita crua nas tabelas do fluxo fora de repositórios. O inventário (grep global) revelou **6 superfícies** (não 4): as 4 nomeadas + **`units/useUnitQueue.ts`** e **`dashboard/BrokerDashboard.tsx`** (fila) + a tabela **`simulation_group_items`**. Rubiam autorizou "tudo agora, 1 commit".

**Métodos de repositório novos (status sempre da fonte única; testes em `__tests__/writeFunnelEtapa5c.test.ts`, 11 casos):**
- `pipeline_simulations`: `createSimulation` / `updateSimulation` / `deleteSimulation` (builder grava `status "ativa"` canônico; `created_by`/`follow_up_at` só quando presentes — fiel ao inline).
- **`simulationGroupsSupabaseRepository.ts` (novo):** `createSimulationGroup` (`status "active"`) + `createSimulationGroupItems`.
- `negotiations`: `createNegotiationFromClient` (OPEN + origem/notes, sem unit_id); `markClientActiveNegotiationsLost` (varre `{OPEN,IN_PROGRESS}` derivado do enum, LOST + `lost_at_stage` por linha); `createNegotiationForConversion.unitId` alargado p/ `string|null`.
- `unit_queue_entries`: `createUnitQueueEntry` expandido (`client_id`/`broker_id`/`reason`, `negotiationId` nullable); `promoteUnitQueueEntry` (+`promoted_at`); `removeUnitQueueEntry` (+`removed_at`/`removed_reason`); `updateUnitQueuePosition`. **Paridade mock** (`negociacoes/repositories/unitQueueRepository.ts`) mantida (guarda-corpo 5).

**Diff lógico por superfície (antes → agora; efeitos preservados):**
1. `useEnviarParaPipeline`: `pipeline_simulations` ins/upd → `createSimulation`/`updateSimulation`; `negotiations` ins → `createNegotiationForConversion` (IN_PROGRESS + owner).
2. `SimuladorPage`: orquestração multi-tabela do grupo (sims em loop + `simulation_groups` + `simulation_group_items`, com `ordem`/unidade-atual-no-fim) **extraída do JSX** para `services/salvarGrupoSimulacao.ts` (guarda-corpo 4); best-effort preservado (falhas engolidas como os `.then(()=>{},()=>{})`).
3. `KanbanPage`: `pipeline_simulations` del → `deleteSimulation`.
4. `ClientDetailPage`: cascata LOST → `markClientActiveNegotiationsLost` (erro não aborta arquivamento, só loga); converter → `createNegotiationFromClient`; `clients`/`contact_interactions` seguem inline (fora do fluxo).
5. `units/useUnitQueue`: entrar/sair/promover/remover → `createUnitQueueEntry`/`removeUnitQueueEntry`/`promoteUnitQueueEntry`/`updateUnitQueuePosition`. **Reordenação de posição continua no hook** (orquestração legítima em hook; escrita no repo).
6. `BrokerDashboard`: dispensar promoção → `removeUnitQueueEntry` (remove o card sempre, engole rejeição — comportamento preservado).

**Preservações estritas (guarda-corpo 6):** `|| null` (0→null) mantido nos campos de balão/permuta do grupo; `created_by`/`follow_up_at` omitidos quando ausentes; sem `updated_at` onde o inline não gravava.

**GREP FINAL DECISIVO:** `.from(<tabela do fluxo>).insert/update/delete/upsert` fora de `infra/repositories/` = **apenas `NegotiationDetailPage.tsx` (`:934/:936/:1814`) — arquivo do WIP importador** (exceção listada). `third_party_properties` (3 syncs no `usePipelineActions`) permanece como pendência já registrada (tabela periférica sem repo).

**DECLARAÇÃO FORMAL:** *governança 4 ("escrita só via repositório") vale GLOBALMENTE em `src/`, com as únicas exceções sendo o WIP do importador (fecha na aterrissagem) e `third_party_properties` (pendência própria registrada).*

**Validação:** `tsc --noEmit` 0 erro; `npm run build` verde; `check:contracts` 9/9; suíte **796** (baseline 785 + 11 testes novos). **SEM merge, SEM deploy, SEM DDL.**

## Ciclo de produção — Etapa 5c no ar (2026-07-04) — AUTORIZADO pelo Rubiam
**Merge:** `feat` → `main` por **fast-forward SEM squash** (`adb3c33..940c80f`), preservando os hashes (`1b83b18` doc do ciclo anterior + `91394ff` Etapa 5c + `940c80f` backup). Via `git worktree` — WIP do importador (21 arquivos) intocado. `main == origin/main` antes e depois.

**Dump extra pré-deploy:** `supabase/backups/20260704_module_tables_pre_prod_deploy_etapa5c.json` — 10 tabelas do fluxo (units:187, pipeline_simulations:9, negotiations:4, simulation_groups:0, simulation_group_items:0, …). Commitado na feat antes do merge.

**Deploy Vercel (integração git):** `dpl_JBbQqjK35vmkqZzgn7YN2SA65kTJ` — `source: git`, `target: production`, `githubCommitSha=940c80f`, estado **READY** (build ~44s, iad1), aliasado a **`app.nexacomercial.com.br`**. Sanidade: domínio HTTP **200**; commit do deploy == tip da `main`. Deploy anterior: `dpl_9agCvV…` (adb3c33).

**Delta no ar:** Etapa 5c — funil de escrita GLOBAL (6 superfícies via repositórios; governança 4 global exceto WIP e TPP). **Nenhum DDL, nenhuma mudança de código** — só merge + deploy.

**Rollback padrão (só com autorização):** `git revert 91394ff && git push` na `main`, ou promover `dpl_9agCvV…` (adb3c33) no dashboard. Não executado.

## Ciclo de produção — Fase 3 Etapas 3→5 no ar (2026-07-03) — AUTORIZADO pelo Rubiam
**Merge:** `feat/atividades-mobile-onda1` → `main` por **fast-forward SEM squash** (`14f0fb8..adb3c33`), preservando todos os hashes registrados neste doc (67c5bec, 04b84da, 065a417, c1fe737, fad0988, 6c7439f, 6cf505c, 6e273a7, a10362e + backup `adb3c33`). Executado via `git worktree` para **não tocar** o WIP do importador (21 arquivos, seguem não-commitados no working tree). Push validado ff no remoto (`main == origin/main` antes e depois).

**Dump extra pré-deploy** (plano free, sem PITR): `supabase/backups/20260703_module_tables_pre_prod_deploy.json` — tabelas do fluxo comercial, contagens `{negotiations:4, proposals:2, reservation_requests:1, reservations:1, sales:0, units:187, unit_queue_entries:1, pipeline_simulations:9, simulation_groups:0}`. Commitado na feat ANTES do merge (viaja junto).

**Deploy Vercel (integração git):** `dpl_9agCvVHqaX6WbtkcpgKWKw8D4YTi` — `source: git`, `target: production`, `githubCommitSha=adb3c33` (ref `main`), estado **READY** (build ~45s, região iad1), aliasado a **`app.nexacomercial.com.br`**. Sanidade: domínio de produção HTTP **200**; commit do deploy == tip da `main` (`adb3c33`). Deploy anterior de produção era `dpl_GD7b9iE…` (14f0fb8).

**Delta no ar:** Etapa 3 (tolerância de leitura removida no Kanban) · 3b (lógica estrita + tradutor de histórico) · 4 (contrato enum×banco) · 5 Bloco 1 (funil de escrita via repositórios + fix M1 da fila) · 5 Bloco 2 (CHECK de `unit_queue_entries`, já aplicado em prod nas migrations). **Nenhum DDL neste ciclo** (o DDL da fila foi no Bloco 2, à parte); **nenhuma mudança de código** — só merge + deploy.

**Rollback padrão (se necessário, só com autorização do Rubiam):** `git revert <sha> && git push` na `main` (integração git redeploya), ou promover deploy anterior `dpl_GD7b9iE…` no dashboard. Não executado.

## Etapa 5 — Bloco 1: funil de escrita do `usePipelineActions` (2026-07-03)
**Objetivo do bloco:** toda escrita de `usePipelineActions.ts` nas tabelas do fluxo comercial passa a ir por método de repositório (governança #4 — hook não faz insert/update/delete direto). Muda o **caminho**, não o comportamento.

**Métodos de repositório adicionados (fonte única de status, zero literal novo):**
- `proposals`: `updateProposalDetails(id, {...})`, `rejectActiveProposals(negId)` (varre `PROPOSAL_ACTIVE_CANCELLABLE_DB_VALUES`).
- `negotiations`: `touchNegotiation(id)`, `createNegotiationForConversion({...})`, `markNegotiationLost(id, {reason, lostAtStage})`.
- `reservation_requests`: `cancelPendingRequests(negId)` (varre `RESERVATION_REQUEST_PENDING_DB`); `createReservationRequest.proposalId` alargado p/ `string|null`.
- `reservations`: `createReservation.reservationRequestId` alargado p/ `string|null`.
- `pipeline_simulations`: `updateSimulationStatus(id, PipelineSimulationStatus)` (vocabulário PT — valor do enum = valor do banco).

**GUARDRAIL 1 (semântica de lote = domínio):** divergência encontrada em `rejectActiveProposals` — o filtro atual varre `{draft, sent, under_analysis}`, o "não-encerrado" canônico incluiria também `counter_proposal`. **Decisão do Rubiam: preservar exatamente (excluir `counter_proposal`)** → criado `PROPOSAL_ACTIVE_CANCELLABLE_DB_VALUES` na fonte única, com teste que prova o conjunto exato. `cancelPendingRequests` = `{requested}`, idêntico ao canônico `RESERVATION_REQUEST_PENDING_DB` (sem divergência).

**GUARDRAIL 3 (owner na conversão):** `createNegotiationForConversion` preserva `owner_profile_id = userId` (perfil autenticado), exatamente como o fluxo definia. NULL do importador WIP é regra própria dele — **não** copiada.

**Diff lógico por escrita (antes → agora; efeitos colaterais preservados em ordem):**
1. `criarProposta` — proposta rascunho existente: `proposals.update(amount/entradas/parcelas)` → `updateProposalDetails`. | touch negociação: `negotiations.update(updated_at)` → `touchNegotiation`.
2. `criarProposta` — nova: `proposals.insert(...)` → `createProposal({... createdBy:null, entradaTipo:"percentual"})`; touch → `touchNegotiation`. (auditoria + notificação a gestores inalteradas.)
3. `solicitarReserva`: `reservation_requests.insert(status:"requested")` → `createReservationRequest({... requestedBy:null})`; touch → `touchNegotiation`. (notificação inalterada.)
4. `aprovarReserva`: `reservations.insert(active)` → `createReservation(status:ACTIVE, startedAt/expiresAt:Date)`; `units.update("reserved")` → `updateUnitStatus(RESERVADO)`; `reservation_requests.update("approved")` → `updateReservationRequestStatus(APPROVED)`; touch → `touchNegotiation`. (2 logs + notificação ao solicitante inalterados.)
5. `registrarVenda`: `sales.insert(awaiting_documents)` → `createSale(status:AWAITING_DOCUMENTS, createdBy:null)` (cast `null as string` p/ res/proposta — repo de vendas é WIP, ver pendência); `units.update("sold")` → `updateUnitStatus(VENDIDO)`; `negotiations.update("WON")` → `updateNegotiationStatus(WON)`; `reservations.update("converted")` → `updateReservationStatus(CONVERTED)`. (sync TPP + 3 logs + notificação global inalterados.)
6. `converterSimulacao`: `negotiations.insert(IN_PROGRESS)` → `createNegotiationForConversion`; `pipeline_simulations.update("convertida")` → `updateSimulationStatus(CONVERTIDA)`. (sync TPP inalterado.)
7. `cancelarNegociacao` (cascata): `proposals.update("rejected").in(...)` → `rejectActiveProposals`; `reservation_requests.update("cancelled").eq("requested")` → `cancelPendingRequests`; por reserva ativa: `reservations.update("cancelled")` → `updateReservationStatus(CANCELLED)` + `units.update("available")` → `updateUnitStatus(DISPONIVEL)` + `promoteQueueFirst`; `negotiations.update("LOST"+campos)` → `markNegotiationLost`. (log + sync TPP inalterados.)

**Preservações de comportamento (fidelidade estrita, não melhorias):**
- `createdBy`/`requestedBy` passados como **`null`** onde o insert inline não os setava (mantém o default do banco). Capturar o ator é melhoria latente — fora de escopo.
- `updated_at` que o repo escreve = `now()` ≡ default do banco nos inserts que o omitiam.

**GREP DECISIVO:** `usePipelineActions.ts` tem **zero** escrita direta em tabela do fluxo comercial. Restam nele apenas: `activity_logs` (helper de auditoria — fora do fluxo, permanece), `notifications` (fora do fluxo) e `third_party_properties` ×3 (tabela periférica **sem repositório** e ausente do §9 do CLAUDE.md).

**Validação:** `tsc --noEmit` 0 erro; `npm run build` verde; `check:contracts` 8/8; suíte **784** (baseline 782 + 2 testes de lote novos em `src/infra/repositories/__tests__/pipelineBatchWrites.test.ts`, que provam a varredura exata do agrupamento canônico). Commit: **este commit** `fase3 etapa5a(2)`.

**PENDÊNCIA — funil de escrita GLOBAL (fora do `usePipelineActions`, requer decisão de escopo do Rubiam):** o grep de tabelas do fluxo achou escritas diretas **pré-existentes** em 5 superfícies que **nunca** estiveram no mapa aprovado deste bloco:
- `src/modules/simulador/hooks/useEnviarParaPipeline.ts` (:54 update / :58 insert `pipeline_simulations`; :103 insert `negotiations`) — **já documentado no header do `pipelineSimulationsSupabaseRepository.ts` como "sprint futura de consolidação"**.
- `src/modules/simulador/pages/SimuladorPage.tsx` (:824 insert `pipeline_simulations`).
- `src/modules/negociacoes/pages/KanbanPage.tsx` (:633 delete `pipeline_simulations`).
- `src/modules/clientes/pages/ClientDetailPage.tsx` (:1133 update / :1177 insert `negotiations`).
- `src/modules/negociacoes/pages/NegotiationDetailPage.tsx` (:934/:936/:1814 `negotiations`) — arquivo com **WIP importador** por cima; tratar junto do desembarque do WIP.
  → Bloco 1 fecha o funil do **`usePipelineActions`** (deliverable nomeado). Fechar o funil **global** (CRUD de `pipeline_simulations` do simulador + escritas de negociação da ficha/cliente) é um **Bloco próprio**, a autorizar. Não tocado aqui (sem scope creep).
- **`third_party_properties`** (3 syncs fire-and-forget no `usePipelineActions`): tabela periférica sem repo — criar `thirdPartyPropertiesSupabaseRepository` numa etapa futura.
- **`sales` (WIP):** `createSale` mantém `reservationId`/`proposalId` non-nullable; venda direta (sem reserva/proposta) usa cast `null as string` no chamador. **Alargar a assinatura p/ `string|null` quando o repo de vendas (WIP) aterrissar.**

**Contratação Supabase Pro + Vercel Pro — ADIADA:** de 03/07 para a **semana de 06/07/2026** (decisão do Rubiam). Até lá, mantém-se: **dump lógico obrigatório antes de qualquer DDL** + **dump extra no próximo ciclo de merge+deploy**. Bloco 2 (CHECK de `unit_queue`) **não inicia** sem autorização explícita do Rubiam.

## Etapa 5 — Bloco 2: CHECK constraint de `unit_queue_entries` (2026-07-03) — AUTORIZADO pelo Rubiam
**Objetivo:** travar a **última** tabela do fluxo sem CHECK de status, completando o invariante "o banco se defende" em TODAS as tabelas comerciais. Governança #2 e #3.

**Verdade do banco (antes do DDL):** `unit_queue_entries` com 1 registro, `status='waiting'` (canônico); única tabela do fluxo sem CHECK; nenhuma função/trigger do Postgres escreve nela — toda escrita vem do frontend, 100% via `unitQueueSupabaseRepository` (Bloco 1).

**Backup (plano free, sem PITR — inegociável):** dump lógico pré-DDL em `supabase/backups/20260703_unit_queue_pre_etapa5b.json` (schema via migrations + dados). Re-verificação imediata antes do DDL: `SELECT status,count(*) … GROUP BY status` → **só `waiting` (1)**. Zero valor fora do canônico → seguiu.

**Migrations (padrão consolidado da Etapa 2 — NOT VALID + VALIDATE, valores derivados de `UNIT_QUEUE_DB_VALUES`):**
- `supabase/migrations/20260703121000_unit_queue_status_check_add_not_valid.sql` — `ADD CONSTRAINT unit_queue_entries_status_check CHECK (status IN ('active','promoted','cancelled','waiting','removed','expired')) NOT VALID`.
- `supabase/migrations/20260703121100_unit_queue_status_check_validate.sql` — `VALIDATE CONSTRAINT`.
- Aplicadas em **produção** via MCP (`apply_migration`), ambas `{"success":true}`.

**Manifesto no mesmo commit (regra da Etapa 4):** `db-constraints.ts` ganhou `unit_queue_entries: ['active','promoted','cancelled','waiting','removed','expired']`; teste de contrato deixou de ser exceção — **contrato pleno de 8 tabelas** (TODO "sem CHECK até Etapa 5" removido). `check:contracts` 9 casos.

**Prova de que MORDE (produção, `BEGIN…ROLLBACK` com status inválido):**
```
ERROR: 23514: new row for relation "unit_queue_entries" violates check constraint "unit_queue_entries_status_check"
DETAIL: Failing row contains (..., not_a_real_status, 999, ...).
```
Rollback confirmado: `count(*)=1`, `waiting=1` (nada persistido).

**Estado da constraint (pg_constraint):** `convalidated = true`; def = `CHECK ((status = ANY (ARRAY['active','promoted','cancelled','waiting','removed','expired'])))`.

**Isto encerra as pendências abertas nas Etapas 2/3/4** sobre a fila: (Etapa 2) "CHECK ADIADO para Etapa 5" ✅; (Etapa 3) "Exceção `unit_queue` mantida" — tolerância de leitura já removida no Bloco 1, agora o banco também trava ✅; (Etapa 4) "unit_queue sem CHECK → TODO Etapa 5" ✅.

**Validação:** `tsc --noEmit` 0 erro; `npm run build` verde; `check:contracts` 9/9; suíte **785** (baseline 784 + 1 caso de contrato da fila). **SEM merge na main, SEM deploy** — próximo ciclo (merge + deploy + validação em produção) será autorizado à parte pelo Rubiam.

**Decisão de produto reconfirmada neste checkpoint (Rubiam):** `counter_proposal` fica **FORA** da cascata de cancelamento (`rejectActiveProposals` varre só `{draft,sent,under_analysis}` via `PROPOSAL_ACTIVE_CANCELLABLE_DB_VALUES`). Registrada no Bloco 1, ratificada aqui.

## Etapa 3b — lógica estrita vs exibição de histórico (2026-07-03)
- **DECISÃO DE PRODUTO:** o histórico (`negotiation_history`, `unit_history`) é **trilha de auditoria imutável**. **NÃO** normalizar via UPDATE. Quem **exibe** histórico usa tradutor de exibição **tolerante** (`src/shared/utils/formatHistoricalStatus.ts`); quem faz **lógica** usa só o **canônico** (`src/domain/status/`). `negotiation_history` contém legado UPPER de proposta/reserva (DRAFT, SENT, UNDER_ANALYSIS, REQUESTED, APPROVED, IN_PROGRESS + null) — preservado.
- **Inventário (Parte A):** os 5 consumidores do util compartilhado `normalizeStatus` eram **todos status vivo (i)** — `CentralPage`, `CentralMobile`, `useCentral`, `useRelatorioIndividual`, `ClientDetailPage`. **Zero categoria (ii)**. Nenhum consumidor usa normalização para lógica sobre histórico.
- **Feito:** `isNegotiationActive`/`NEGOTIATION_DONE_VALUES` movidos para `src/domain/status/negotiation.ts` (estrito); 5 consumidores migrados; `useCadenceAlerts` estrito; **`src/shared/utils/normalizeStatus.ts` + teste DELETADOS**; tradutor `formatHistoricalStatus` criado (com testes dos legados reais + fallback). Commit `fad0988`. Build verde, 0 TS, check:contracts OK, suíte 780.
- **Nota:** o tradutor ainda **não tem consumidor** — o histórico de negociação não é renderizado como label hoje (só `unit_history` no `UnitsPanel`). Fica pronto para a timeline (WIP).
- **PENDÊNCIA (fora de escopo, futura):** `vocabulário de units/unit_history fora de src/domain/status/` — `UnitsPanel` traduz `unit_history.toStatus` (DISPONIVEL/RESERVADO) via `getUnidadeStatusLabel`; avaliar levar o vocabulário de unidade para a fonte única + um contrato numa etapa futura.

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

---

## Mitigação de backup — GitHub Actions `pg_dump` diário (2026-07-09)
**Contexto:** Supabase no plano **FREE**, **sem PITR/backup automático** (contratação do Pro **adiada por decisão do Rubiam**, já registrada). Até então o backup era só dump manual pré-DDL. Objetivo: fechar a janela de risco com backup **diário automatizado e gratuito**.

**Feito:**
- `.github/workflows/backup-diario.yml` — workflow agendado (`cron 0 6 * * *` = **03:00 Brasília**, UTC-3) **e** manual (`workflow_dispatch`). Instala `postgresql-client-17` (compatível com o Postgres 17 do projeto), roda `pg_dump --format=custom --no-owner --no-privileges` do banco de **produção** e publica o resultado como **artifact privado** (retenção **30 dias**).
- **Credencial fora do repo:** connection string lida do **GitHub Secret `SUPABASE_DB_URL`** — nunca commitada. Guard explícito: secret ausente → step falha com `::error::`.
- **Falha visível (sem catch silencioso):** `set -euo pipefail` + `test -s` no dump + `if-no-files-found: error` no upload → qualquer falha deixa o workflow vermelho e o GitHub notifica por e-mail.
- `docs/governance/BACKUP.md` — como funciona, **restauração passo a passo (`pg_restore`, inclusive seletiva)**, onde configurar o secret, limites conhecidos e a nota de que **isto é mitigação até o Supabase Pro (PITR)**.

**Passo manual pendente do Rubiam (uma vez):** criar o secret `SUPABASE_DB_URL` em *Settings → Secrets and variables → Actions* (valor = connection string **direta**/porta 5432 ou *Session pooler* — **não** o *Transaction pooler* 6543) e disparar o workflow manualmente uma vez para validar (run verde + artifact baixável). Detalhes em `BACKUP.md §2`.

**Validação:** YAML válido (`js-yaml` load OK). **Sem merge, sem deploy, sem DDL.** WIP do importador (21 arquivos) fora do stage.

## Funil Unificado — Fase A: `negotiations.status` como verdade única do estágio (2026-07-09)
**Contexto/problema (verificado no banco em 04/07, reconfirmado 09/07):** as 5 negociações estavam **todas `IN_PROGRESS`**, inclusive `3fe48512…` (proposta `under_analysis`) e `3fd28a03…` (proposta `under_analysis` + reserva `active`). Nada avançava o estágio — a Lista lia `status` (abas mentiam) e o Kanban derivava o estágio dos filhos por conta própria (duas verdades divergentes). A partir da Fase A, `negotiations.status` **carrega o estágio**, mantido automaticamente pelos repositórios a cada escrita de marco.

**Decisão de produto — regra de derivação (`deriveNegotiationStage`, pura):** o estágio reflete o **marco ATIVO mais avançado**: (1) venda não-cancelada → `WON`; (2) senão reserva **ATIVA** → `RESERVATION`; (3) senão proposta **aberta** (`draft/sent/under_analysis/counter_proposal`) → `PROPOSAL`; (4) senão base. **`LOST`/`CANCELLED` são terminais e NUNCA sobrescritos** pela derivação (só ação explícita). **`OPEN`** permanece `OPEN` sem marco (nunca auto-promovido); qualquer outro não-terminal sem marco cai para `IN_PROGRESS` (permite **regressão entre marcos**).

**Parte 1 — Domínio:** `src/domain/status/negotiationStage.ts` (função pura) + `PROPOSAL_OPEN_VALUES` na fonte única (inclui `counter_proposal`; distinto de `PROPOSAL_ACTIVE_CANCELLABLE`, que o exclui por design da cascata). Testes exaustivos (`__tests__/negotiationStage.test.ts`): todas as combinações, terminais intocáveis, regressões, idempotência.

**Parte 2 — Gancho nos repositórios:** `src/infra/repositories/recomputeNegotiationStage.ts` — lê os filhos (query DIRETA, p/ evitar ciclo de import), deriva, **grava só se mudou** (idempotente; não polui `updated_at`/histórico), e registra a transição no `negotiation_history` (`from`/`to`, **ação nova `NEGOTIATION_STAGE_CHANGED`**, `performed_by = null` = sistema). Chamado por: `createProposal`, `updateProposalStatus`, `createReservation`, `updateReservationStatus`, `createSale`, `updateSaleStatus`.
  - **`negotiation_history.action` é `text` livre (SEM CHECK no banco — verificado via `pg_constraint`)** → a ação nova é só código de app (enum + case no read-path `normalizeNegotiationHistoryAction`); **não precisou de DDL**.
  - **NÃO** ligado a `rejectActiveProposals`/`cancelPendingRequests` (cascata de cancelamento) nem a `updateProposalDetails`: as cascatas terminam em `markNegotiationLost` (terminal explícito) — recomputar no meio só geraria evento intermediário espúrio; `updateProposalDetails` não muda marco (no-op). Decisão registrada.

**Parte 3 — Leitores:**
  - **Lista** (`NegotiationsPage`): `STATUS_PILLS`/`STATUS_COLOR` já tinham `PROPOSAL`/`RESERVATION` no vocabulário canônico → **zero ajuste**, passa a refletir os estágios reais.
  - **Kanban** (`getEstagio`): **NÃO refatorado** (é a Fase B). Ajuste **mínimo**: backstop por `status` (`PROPOSAL`→proposta, `RESERVATION`→reserva) **depois** dos checks por filho, para não sumir card cujo filho não veio no join. `usePipelineActions` segue usando `touchNegotiation` (não há escrita de estágio concorrente); `WON` na venda já era gravado e é idempotente com o recompute.

**Divergências/consequências FLAGUEADAS (decisão de produto — confirmar):**
  1. **Solicitação de reserva pendente (`reservation_requests.status='requested'`)** NÃO promove para `RESERVATION` (a regra é "reserva **ATIVA**"). Mas o Kanban `getEstagio` hoje coloca solicitação pendente na coluna **reserva** (linha 61). Durante a janela "solicitada, ainda não aprovada", o `status` da negociação dirá `PROPOSAL` e o card ficará em "reserva". Alinhar isso é Fase B.
  2. **Proposta `accepted` NÃO conta como aberta** → aceitar uma proposta sem ainda criar reserva/venda deriva `IN_PROGRESS` (regressão visível de `PROPOSAL`). Se o fluxo aceitar-proposta e criar-reserva não forem atômicos, haverá um evento `NEGOTIATION_STAGE_CHANGED` intermediário. **Confirmar** se `accepted` deveria segurar `PROPOSAL`.

**Adiamento formal (decisão do Rubiam):** **Etapas 6–8 do endurecimento (Fase 3) ficam ADIADAS** para depois do Funil Unificado.

**Validação (DoD):** `tsc -b` 0 erro; `vite build` verde; `check:contracts` **9/9**; suíte **833** (baseline 796 + 37 novos: derivação, recompute/idempotência, backstop do Kanban). Zero literais de status (tudo da fonte única); zero escrita de negociação fora de repositório. **SEM merge, SEM deploy.** `git add` explícito por arquivo; **WIP do importador fora do stage** (o `salesSupabaseRepository.ts`, que é WIP-dirty, teve APENAS meus 3 hunks staged via `git apply --cached`; o `logSaleAdvanceOverride` do importador permaneceu unstaged).

**Migração de dados (Parte 4) — APLICADA EM PRODUÇÃO (2026-07-09, AUTORIZADA pelo Rubiam):**
- **Dump lógico antes (Governança 11):** `supabase/backups/20260709_negotiations_pre_faseA_stage_migration.json` — `negotiations` (5) + `negotiation_history` (8), com nota de reversão.
- **Re-verificação imediata antes do UPDATE:** 5 negociações, todas `IN_PROGRESS`; derivação prevê 2 mudanças (idêntico à checagem de 04/07).
- **SQL aplicado (transação única, `UPDATE` guardado por `status='IN_PROGRESS'` + `INSERT` de history):**
  ```sql
  UPDATE negotiations SET status='PROPOSAL', updated_at=now()
   WHERE id='3fe48512-65a3-4e92-8d26-2d7f4e1ce630' AND status='IN_PROGRESS';
  INSERT INTO negotiation_history (negotiation_id, from_status, to_status, action, performed_by)
   VALUES ('3fe48512-65a3-4e92-8d26-2d7f4e1ce630','IN_PROGRESS','PROPOSAL','NEGOTIATION_STAGE_CHANGED',NULL);
  UPDATE negotiations SET status='RESERVATION', updated_at=now()
   WHERE id='3fd28a03-6048-483a-ace0-48804b1a9648' AND status='IN_PROGRESS';
  INSERT INTO negotiation_history (negotiation_id, from_status, to_status, action, performed_by)
   VALUES ('3fd28a03-6048-483a-ace0-48804b1a9648','IN_PROGRESS','RESERVATION','NEGOTIATION_STAGE_CHANGED',NULL);
  ```
- **Verificação pós-migração:** contagem `{PROPOSAL:1, RESERVATION:1, IN_PROGRESS:3}`; `3fe48512…`=`PROPOSAL`, `3fd28a03…`=`RESERVATION`; **2** eventos `NEGOTIATION_STAGE_CHANGED` (`from IN_PROGRESS`, `performed_by=null`); `negotiation_history` 8 → 10. As outras 3 negociações permanecem `IN_PROGRESS`. **Aplicado via MCP `execute_sql`. Sem merge, sem deploy, sem DDL.**
- **Reversão (se preciso):** `UPDATE negotiations SET status='IN_PROGRESS' WHERE id IN (…);` + `DELETE FROM negotiation_history WHERE action='NEGOTIATION_STAGE_CHANGED';` (ver `_meta.restore_note` do dump).

## Funil Unificado — Fase B (Bloco 1): fonte única + Kanban + Lista (2026-07-09)
**Objetivo:** unificar Pipeline+Negociações sobre a MESMA fonte de verdade; fim da divergência de números entre telas. Estágio vem EXCLUSIVAMENTE de `negotiations.status` (Fase A).

**Decisões de produto (aprovadas pelo Rubiam) — registradas:**
- **Mapeamento estágio→coluna:** Em negociação = OPEN+IN_PROGRESS · Proposta = PROPOSAL · Reserva = RESERVATION · Venda = WON · Perdido = LOST+CANCELLED.
- **Solicitação de reserva PENDENTE não muda coluna/estágio** (pedido ≠ marco; o marco é a aprovação). Aparece na faixa de decisões pendentes e como indicação no card ("solicitação aguardando aprovação"), sem mover o card.
- **Simulações são PRÉ-FUNIL:** fora de contagens/VGV; faixa própria recolhível no Kanban.
- **Rótulos canônicos:** Em negociação, Proposta, Reserva, Venda, Perdido (encerra "Ganhas/Aberta"). **Cores:** sprout `#4ADE80`, azul `#7DA7F4`, âmbar `#E8B45A`, verde `#34D399`, cinza `#706B5F`.

**Feito (Bloco 1):**
- `src/modules/negociacoes/board/stageColumn.ts` — PURO: `columnOfStatus`, `STAGES` (labels+cores), `FUNNEL_FLOW`. Fonte única do mapeamento/rótulos/cores.
- `board/semaphore.ts` — PURO: `semaphoreOf` (verde=ação agendada · âmbar=sem próxima ação · vermelho=parada há Xd/prazo vencido). Degrada com honestidade (sem dado → âmbar).
- `board/buildBoard.ts` — PURO: agrega os cards da fonte única em contadores/VGV por estágio, abertas, pendências e pré-funil. **Contadores calculados AQUI, uma vez** → números idênticos nas visões por construção.
- `hooks/useNegotiationsBoard.ts` — FONTE ÚNICA (envolve `useKanbanData` + busca + `buildBoard`). `useKanbanData` ganhou `next_action_at/last_activity_at/follow_up_at` (semáforo).
- **Kanban** refatorado: `getEstagio` **morreu**; colunas = mapeamento; card **enxuto de 3 linhas** (unidade+valor / cliente / semáforo) + indicação de solicitação pendente; **faixa de decisões pendentes** (topo) e **faixa de pré-funil recolhível** (rodapé). Todas as ações preservadas (hover + menu + modais + simDetail).
- **Lista** refatorada: chips de estágio **com contadores** (no lugar das abas) + tabela (Negociação · Corretor · Estágio · Valor · Próxima ação/semáforo · Atualizada), ordenação valor/data. Consome a MESMA fonte (mata a divergência: antes o VGV vinha de `useUnits` separado; agora do mesmo join).
- Testes: mapeamento, semáforo, `buildBoard` (coerência contador×agrupamento, abertas, pendências, pré-funil).

**Realocação de ações (nada se perde):** a ficha (`NegotiationDetailPage`, camada `useNegotiationDetail`) já cobre todas as capacidades do Kanban + mais; o card enxuto mantém as ações no hover/menu, então nenhuma ação foi movida/perdida e a **ficha WIP não foi tocada**. `converterSimulacao` (exclusivo do Kanban) segue no modal de simulação da faixa pré-funil.

**Pendências novas (fora do escopo desta fase):** metas como entidade (KPI "meta do mês" adiado); SLA configurável; alinhar sub-estágios (Fase E, precisa DDL). **BLOCO 2 (Funil) e BLOCO 3 (rota+menu) — a seguir.**

**Validação:** `tsc` 0 erro; `vite build` verde; `check:contracts` 9/9; suíte **852** (baseline 833 + 19). Sem merge, sem deploy, sem DDL. WIP do importador fora do stage.
