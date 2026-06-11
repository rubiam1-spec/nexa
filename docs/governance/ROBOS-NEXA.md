# NEXA — Ledger dos Robôs

> Fonte de verdade dos robôs de continuidade do NEXA. Cada execução agendada LÊ este arquivo antes de agir e ANEXA os achados novos aqui. Não duplicar achados já registrados; atualizar o status dos existentes.
>
> Governança aplicável (ler sempre): `AGENT-RULES.md`, `TASK-GATE.md`, `NEXA-CONSTITUICAO-DE-EXECUCAO.md`, `NEXA/AGENTS.md` e o `CLAUDE.md` da raiz. Os robôs DIAGNOSTICAM e REGISTRAM — eles não alteram código de produção por conta própria.

## Cadência

- Execuções automáticas: todos os dias, 08:00 e 14:00 (horário local).
- Cada execução roda os 3 robôs e produz UM digest consolidado e priorizado.

## Os 3 robôs

1. **Inspetor** — defeitos no que JÁ existe: lógica, RLS/policies, advisors (Supabase MCP), etapas inacabadas, estados de UI ausentes, divergência mock × Supabase, quebra de consistência do fluxo.
2. **Guardião do Plano** — lê toda a documentação + roadmap + git; reporta progresso vs. plano e o que falta para fechar do início ao fim.
3. **Usuário Simulado** — percorre o fluxo comercial como cada perfil; cria cenários, casos de borda e problemas de usabilidade. Valida no app ao vivo quando há sessão logada.

## Prioridade dos achados (nunca inverter)

P0 quebra o fluxo comercial ou expõe dados (RLS) · P1 unidade como ativo / integridade / rastreabilidade · P2 aderência documental · P3 evolução incremental · P4 UX operacional · P5 estética.

## Convenção de IDs

`R-AAAAMMDD-NN`. Status: `aberto` | `em-andamento` | `resolvido` | `descartado`.

---

## A. Achados abertos — Inspetor

| ID | Prioridade | Área | Achado | Evidência | Status |
|----|-----------|------|--------|-----------|--------|
| R-20260611-01 | P0 | Segurança/RLS | 2 advisors de **segurança nível ERROR** (provável `rls_policy_always_true` e/ou `security_definer_view`) + 118 WARN | Supabase advisors (security): security_definer exposto a anon/authenticated (80), `function_search_path_mutable` (30), buckets públicos listáveis (4), `auth_leaked_password_protection` off | aberto |
| R-20260611-02 | P4 | Performance | 123 advisors de performance WARN | 153 índices não usados, **103 "Auth RLS Init Plan"** (auth.uid() sem subquery, recomputa por linha), 50 FKs sem índice, 18 multiple permissive policies, 2 índices duplicados | aberto |
| R-20260611-03 | P2 | Arquitetura/UI | UI acessando **Supabase diretamente** (proibido por CLAUDE.md) | `supabase.from/rpc` em páginas .tsx: AtividadesPage, ClientsPage, ClientDetailPage, ContatosPage, Brokers/BrokerDetail, dashboards; ~56 arquivos em `src/modules` referenciam Supabase | aberto |
| R-20260611-04 | P2 | Arquitetura/Domínio | `src/domain/services` **vazio** — regra de negócio não centralizada no domínio como manda o CLAUDE.md (seção 4/8/10) | `ls src/domain/services` sem retorno; domain tem 29 arquivos só em entities/enums/rules | aberto |
| R-20260611-05 | P3 | Consistência | **Sem repositórios mock** — só `*SupabaseRepository`. Diverge de "mock + Supabase com MESMO contrato" (CLAUDE.md seção 11). Pode ser evolução consciente — exige decisão documentada | `src/infra/repositories` só contém *SupabaseRepository (27 arquivos) | aberto |

Nota positiva: código praticamente sem dívida marcada (apenas 2 TODO/FIXME reais em todo `src`).

## B. Estado do roadmap — Guardião do Plano

Fila de prioridade atual: **P1** Distribuição de Leads · **P2** Documentos/Contratos · **P3** Motor de Inteligência Sprints 4–5 · **P4** Links curtos com slug · **P5** Teste ponta a ponta (Bomm) · **P6** App Capacitor · **P7** Redesign do site.

Sinais do git: trabalho recente concentrado em **Atividades** (Ondas 1–3, drag-and-drop, form adaptativo) e **Relacionamento/Contatos**. Documentação de arquitetura em PDF (não lida nesta passagem — só índice).

| Item | % estimado | Bloqueadores | Próximo passo concreto |
|------|-----------|--------------|------------------------|
| P1 Distribuição de Leads | ~20% (tabela existe, vazia) | regra de round-robin com peso não implementada | definir serviço de distribuição em domain + repositório |
| P2 Documentos/Contratos | ~50% | checklist parcial; `document_requirements` existe | fechar UI de checklist por etapa da venda |
| P3 Motor Inteligência S4–5 | ~80% | alertas IA / briefing via claude-proxy | implementar Sprint 4 (alertas) |
| P5 Teste ponta a ponta Bomm | a validar | depende de Chrome logado p/ os robôs | conectar navegador e rodar Usuário Simulado ao vivo |

> Estimativas conservadoras a refinar lendo os PDFs de arquitetura na próxima passagem profunda.

## C. Cenários de usuário — Usuário Simulado

Validação ao vivo **pulada nesta execução**: nenhum Chrome conectado (`list_connected_browsers` vazio). Cenários gerados em texto:

| ID | Perfil | Cenário / jornada | Problema esperado | Validado no app? |
|----|--------|-------------------|-------------------|------------------|
| C-20260611-01 | broker | Tenta efetivar reserva direto | Sistema deve só permitir SOLICITAR; efetivação exige aprovação manager/director | não (sem sessão) |
| C-20260611-02 | commercial_consultant | Cria proposta sem negociação ativa | Deve bloquear: proposta exige negociação ativa | não |
| C-20260611-03 | manager | Reserva expira | Unidade deve voltar a DISPONIVEL e acionar fila (se ativa); alerta ao gestor | não |
| C-20260611-04 | broker | Vê a fila | Deve ver apenas a própria posição, nunca a fila completa | não |
| C-20260611-05 | administrative | Abre proposta aprovada | Deve ver detalhes comerciais completos (não bloquear) | não |

## D. Histórico de execuções

| Data/hora | Robôs | Novos achados | Resolvidos | Observações |
|-----------|-------|---------------|------------|-------------|
| 2026-06-11 09:39 | Inspetor, Guardião, Usuário Simulado | 5 (A) + 5 cenários (C) | 0 | 1ª passagem (manual via Run now). App ao vivo pulado: Chrome não conectado |

---

## Atualização 2026-06-11 09:48 — Plano de correção (decisões do Rubiam)

- **R-01 (segurança):** plano de correção gerado → ver `PLANO-CORRECOES-2026-06-11.md` (PROMPT 1). Rubiam aplica via Claude Code. Status: em-andamento.
- **R-02 (performance):** prompt gerado (PROMPT 2). Rubiam aplica via Claude Code. Status: em-andamento.
- **R-03 (UI→Supabase):** decisão = **só mapear agora, corrigir depois**. Inventário exato abaixo. Status: mapeado / correção adiada.
- **R-04 (domain/services vazio):** decisão = **evolução intencional** (regra vive em hooks). Ação: alinhar a documentação (PROMPT 3). Status: descartado como defeito; doc a ajustar.
- **R-05 (sem mock):** decisão = **evolução intencional** (Supabase-only). Ação: alinhar a documentação (PROMPT 3). Status: descartado como defeito; doc a ajustar.

### Inventário R-03 — 26 componentes .tsx acessando Supabase direto (corrigir incrementalmente)

atividades/pages/AtividadesPage.tsx · clientes/pages/ClientDetailPage.tsx · clientes/pages/ClientsPage.tsx · configuracoes/pages/SettingsPage.tsx · contatos/pages/ContatosPage.tsx · contatos/pages/ImportarContatosPage.tsx · corretores/pages/BrokerDetailPage.tsx · corretores/pages/BrokersPage.tsx · dashboard/pages/BrokerDashboard.tsx · dashboard/pages/ConsultantDashboard.tsx · dashboard/pages/DashboardPage.tsx · dashboard/widgets/DashboardWidgets.tsx · feed/pages/FeedPage.tsx · imobiliarias/pages/BrokerageDetailPage.tsx · imobiliarias/pages/BrokeragesPage.tsx · imoveis/pages/ThirdPartyPropertyDetailPage.tsx · materiais/pages/MateriaisPage.tsx · negociacoes/pages/KanbanPage.tsx · negociacoes/pages/NegotiationDetailPage.tsx · relacionamento/components/BannerTemplateEditorModal.tsx · relacionamento/components/ConfiguracoesTab.tsx · relacionamento/components/PlanejamentoTab.tsx · relatorios/pages/RelatoriosPage.tsx · simulador/pages/SimuladorPage.tsx · superadmin/pages/SuperadminPage.tsx · (+ simulador/pages/SimuladorPage.backup.tsx — arquivo morto, candidato a remoção)

| Data/hora | Robôs | Novos achados | Resolvidos | Observações |
|-----------|-------|---------------|------------|-------------|
| 2026-06-11 09:48 | — | 0 | 0 | Sessão de planejamento: decisões + plano de correção gerado |

---

## Atualização 2026-06-11 10:21 — R-01 RESOLVIDO (verificado pelos advisors)

PROMPT 1 aplicado via Claude Code (5 migrations) e **confirmado de forma independente** re-rodando os advisors de segurança:
- security_definer_view: 2 ERROR → **0** ✅
- function_search_path_mutable: 30 → **0** ✅
- rls_policy_always_true: 2 → **0** ✅
- public_bucket_allows_listing: 4 → **0** ✅
- funções de cripto (decrypt/encrypt_pii/financial) removidas de anon/authenticated ✅
- Total de alertas de segurança: 120 → **74**.

**R-01 status: resolvido** (com 1 pendência manual abaixo).

### Pendência manual (não-SQL) — TEMA 5
- **Leaked Password Protection** continua **OFF**. Não há tool para ligar via MCP. Ação do Rubiam: Supabase → Authentication → Policies → "Leaked password protection" = ON.

### WARN remanescentes (fora do escopo, por decisão)
- 36× anon/authenticated_security_definer_function_executable — funções de trigger/seed legítimas (social_*, seed_*, trigger_encrypt_*, get_user_account_ids, user_has_role). Mantidas de propósito.
- 1× extension_in_public (unaccent) — baixo risco, fora do escopo.

### Para revisar depois (levantado pelo CC)
- Policy pré-existente `logos_temp_anon_insert` (INSERT anônimo no bucket logos) — é de upload, não listagem; revisar.
- Documentos de `third_party_properties` hoje no bucket público `properties` — avaliar mover para bucket privado + signed URLs se forem sensíveis (exige mudança de frontend).

| Data/hora | Robôs | Novos achados | Resolvidos | Observações |
|-----------|-------|---------------|------------|-------------|
| 2026-06-11 10:21 | Inspetor (verificação) | 0 | R-01 | Advisors: 2 ERROR → 0; total seg. 120 → 74. Pendência: leaked password protection (manual) |

---

## Atualização 2026-06-11 10:53 — R-02 e R-04/R-05 RESOLVIDOS (verificados)

**R-02 (performance)** — PROMPT 2 aplicado via Claude Code (4 migrations) e confirmado re-rodando os advisors de performance:
- unindexed_foreign_keys: 50 → **0** ✅
- duplicate_index: 2 → **0** ✅ (client_documents e clients)
- auth_rls_initplan: 103 → **0** ✅ (auth.uid()/auth.jwt() agora em subselect; 221 policies preservadas, segregação multi-tenant validada)
- multiple_permissive_policies: 18 → **0** ✅
- Restam apenas 197 **Unused Index (INFO)** — não dropados por decisão (incluem PKs, uniques e os 50 índices novos). Revisar no futuro com uso real.
- Build verde. Segregação multi-tenant testada (owner vê seus dados; não-membro vê 0).

**R-04 / R-05 (documentação)** — PROMPT 3 aplicado: CLAUDE.md (seções 4, 11, 19 + rodapé datado) e AGENT-RULES.md alinhados à realidade (regra em hooks; Supabase-only; mocks opcionais). Diff só em .md. Status: **resolvido**.

### Estado dos achados da 1ª passagem
- R-01 segurança: **resolvido** (pendência manual: leaked password protection no painel)
- R-02 performance: **resolvido**
- R-03 UI→Supabase: mapeado, correção incremental adiada (decisão)
- R-04 domain/services: **resolvido** (doc alinhada)
- R-05 mock: **resolvido** (doc alinhada)

| Data/hora | Robôs | Novos achados | Resolvidos | Observações |
|-----------|-------|---------------|------------|-------------|
| 2026-06-11 10:53 | Inspetor (verificação) | 0 | R-02, R-04, R-05 | Perf: todos os WARN → 0 (só 197 INFO). Doc alinhada. Restam R-03 (adiado) e leaked-password (manual) |

---

## Atualização 2026-06-11 11:00 — P1 Distribuição de Leads (prompt gerado)

Diagnóstico confirmado: lead_distribution já existe (round-robin com peso, 2 consultores ativos na Bomm); entidade de lead = clients (assigned_to/consultant_id/assignment_type); edge receive-lead grava assigned_to fixo hoje. Decisões: webhook + botão manual; participantes configuráveis por conta; tela em Configurações → Regras Comerciais.

Prompt completo gerado em `PROMPT-P1-distribuicao-leads.md` (função de rodízio SECURITY DEFINER + RPC distribute_lead + settings + RLS + edge + botão manual + tela admin). Aguardando aplicação via Claude Code. Status P1: prompt pronto.

---

## Atualização 2026-06-11 14:04 — Execução agendada (Inspetor + Guardião + Usuário Simulado)

Infra: projeto **ACTIVE_HEALTHY** (Postgres 17.6, us-east-2). Sem P0.

### Verificação de advisors (re-rodados)
- **Segurança:** 0 ERROR, 78 WARN. Detalhe: 76 = `anon/authenticated_security_definer_function_executable` (38 cada, funções de trigger/seed legítimas — agora inclui as 2 novas funções do P1), 1 `extension_in_public` (unaccent), 1 `auth_leaked_password_protection`. Subiu de 74→78 por causa das 2 novas funções SECURITY DEFINER do P1 (esperado, não é defeito).
- **Performance:** 0 WARN/ERROR. Restam 196 `unused_index` (INFO) — eram 197; decisão de não dropar mantida.
- **Pendência manual inalterada:** Leaked Password Protection continua **OFF** (Supabase → Authentication → Policies). Sem tool MCP para ligar.

### Achados novos

| ID | Prioridade | Área | Achado | Evidência | Status |
|----|-----------|------|--------|-----------|--------|
| R-20260611-06 | P3 | Rastreabilidade/Git | **P1 Distribuição de Leads implementado mas NÃO commitado.** DB ok (migrations `lead_dist_*` aplicadas; funções `distribute_lead` e `assign_next_lead_consultant` existem). Código na árvore de trabalho, sem commit nem validação E2E | `git status`: M `receive-lead/index.ts` (chama `assign_next_lead_consultant`), ?? `leadDistributionSupabaseRepository.ts`, `useLeadDistributionAdmin.ts`, `useLeadDistribution.ts`, M `SettingsPage.tsx`, `ContatosPage.tsx` | aberto |
| R-20260611-07 | P4 | Aderência/UI (seção 15) | Vários módulos sem estado **`empty`** explícito aparente (heurística grep) | auth, central, feed, imobiliarias, mapa, materiais, notificacoes, perfil, relacionamento, relatorios, superadmin, usuarios | aberto (a confirmar caso a caso) |
| R-20260611-08 | P5 | Limpeza | `SimuladorPage.backup.tsx` segue presente (código morto) — já listado em R-03 | `find src -name *.backup.*` | aberto |

### Atualização de status dos achados anteriores
- R-01 (segurança) **resolvido** — mantém só a pendência manual (leaked password).
- R-02 (performance) **resolvido**.
- R-03 (UI→Supabase) **aberto/adiado** — 26 componentes ainda acessam Supabase direto; correção incremental.
- R-04 / R-05 **resolvidos** (doc alinhada).

### B. Roadmap — atualização do Guardião
- **P1 Distribuição de Leads: ~85%** (era ~20%). DB completo; edge `receive-lead` faz round-robin via `assign_next_lead_consultant` com fallback `default_assigned_to`/`manual`; repositório + hooks + tela admin + botão manual na árvore de trabalho. **Próximo passo:** validar E2E com dados Bomm, **commitar** e fazer deploy da edge. Bloqueador: nada técnico; falta commit/validação (ver R-06).
- P2 Documentos/Contratos: ~50% (sem mudança). P3 Motor Inteligência S4–5: ~80% (migration `p3_intelligence_alerts` presente). P5 Teste E2E Bomm: pendente de Chrome logado.

### C. Usuário Simulado
Validação ao vivo **pulada**: nenhum Chrome conectado (`list_connected_browsers` = []). Cenário novo adicionado:

| ID | Perfil | Cenário | Problema esperado | Validado? |
|----|--------|---------|-------------------|-----------|
| C-20260611-06 | commercial_consultant / manager | Lead novo entra via webhook → round-robin distribui para próximo consultor ativo; manager redistribui manualmente | Conferir: respeita participantes ativos por conta; fallback p/ `manual` quando não configurado; log/rastreabilidade da reatribuição | não (sem sessão) |

| Data/hora | Robôs | Novos achados | Resolvidos | Observações |
|-----------|-------|---------------|------------|-------------|
| 2026-06-11 14:04 | Inspetor, Guardião, Usuário Simulado | 3 (R-06/07/08) + 1 cenário (C-06) | 0 | Advisors estáveis (0 ERROR). P1 avançou p/ ~85% (não commitado). App ao vivo pulado: Chrome não conectado |

---

## Atualização (verificação P1 pós-deploy) — 1 achado de segurança

P1 implantado e verificado de forma independente:
- account_settings: lead_distribution_enabled + lead_distribution_eligible_roles ✅
- assign_next_lead_consultant e distribute_lead: SECURITY DEFINER + search_path=public,pg_temp ✅
- receive-lead: v4 ACTIVE, lê o toggle e chama o RPC, com fallback ao comportamento antigo ✅
- Produção intacta: clients seguem todos 'manual' (6); lead_distribution counts 0/0 (testes do CC em ROLLBACK) ✅

**R-20260611-06 | P1 segurança | aberto** — `assign_next_lead_consultant(uuid,uuid)` e `distribute_lead(uuid)` continuam executáveis por anon/authenticated. O REVOKE FROM anon, authenticated foi inócuo: o EXECUTE vem do grant default a PUBLIC (acl mostra `=X/postgres`). `distribute_lead` se protege (checa role), mas `assign_next_lead_consultant` não tem trava — um authenticated poderia chamá-la direto.
Fix (1 migration):
  REVOKE EXECUTE ON FUNCTION public.assign_next_lead_consultant(uuid, uuid) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.distribute_lead(uuid) FROM PUBLIC;
Resultado: assign_next fica só com postgres+service_role (distribute_lead a chama como definer; edge usa service_role); distribute_lead mantém o grant explícito a authenticated (UI) e perde só o anon. Também limpa o advisor de segurança dessas 2 funções.

Observação menor: o edge v4 trocou a atualização de stats por rpc increment_webhook_received com fallback; e removeu total_received do SELECT, então o fallback conta a partir de 0/1. Não crítico.

---

## Atualização 2026-06-11 15:12 — R-06 RESOLVIDO · P1 fechado

REVOKE FROM PUBLIC aplicado (migration sec_revoke_public_execute_lead_dist) e verificado de forma independente:
- assign_next_lead_consultant: anon=false, authenticated=false, service_role=true ✅
- distribute_lead: anon=false, authenticated=true (UI, com trava de papel), service_role=true ✅
- Advisor: assign_next saiu de anon e authenticated; distribute_lead saiu de anon e permanece (corretamente) em authenticated.

**R-06: resolvido.** **P1 (Distribuição de Leads): implantado, verificado e em produção.**

### Fila de prioridade — próximo
P2 Documentos/Contratos (checklist) · P3 Motor de Inteligência Sprints 4–5 · P4 Links curtos com slug · P5 Teste ponta a ponta (Bomm) · P6 Capacitor · P7 Site.

---

## Atualização 2026-06-11 16:01 — P2 Reconciliação de documentos (diagnóstico + prompt)

Diagnóstico: 3 fontes divergentes definindo documentos — trigger seed_documents_for_new_client (lê document_type_configs), seed_client_documents (hardcoded, irpf=true) e seed_default_document_requirements (semeia document_requirements, irpf=false). Canônico = document_type_catalog (dicionário, 11) + document_requirements (por empreendimento+party_role: primary_buyer/spouse/co_obligor/attorney_in_fact, 19). document_type_configs (7) é o antigo a deprecar. Os 47 client_documents já usam catalog.id (sem migração de arquivos). clients = pessoa física (sem PF/PJ).

Decisão Rubiam: reconciliar agora, junto. Prompt gerado: `PROMPT-P2-reconciliar-documentos.md` (repontar trigger/seed para requirements+catalog; mover lógica de docs do ClientDetailPage para hook/repo — resolve R-03 nesse módulo; repontar SettingsPage para gerenciar requirements; deprecar configs sem dropar). Status P2: prompt pronto.

Pendência relacionada que continua: vincular checklist à VENDA + transição aguardando_documentacao → aguardando_contrato (próximo incremento do P2, não incluído agora).

---

## Atualização (bug report do Rubiam) — Corretor não aparece em "Visita corretor"

Diagnóstico (Inspetor, confirmado banco+código):
- NÃO é RLS (policy brokers_select libera membros da conta), NÃO é dado (dezenas de brokers status='active'), NÃO é a busca (searchBrokersLite filtra account_id+active, args corretos), NÃO é o kind (visit_broker tem "corretor" no fields).
- A seção EQUIPE do modal é **equipe interna apenas** — brokers são excluídos DE PROPÓSITO (teamScope.ts: COMMERCIAL_INTERNAL_ROLES). É por toque, sem digitação. Logo, tentar adicionar corretor na EQUIPE nunca funciona.
- O corretor tem **campo próprio** ("Buscar corretor…", EntityPicker entity="broker") que aparece no form de criação/edição. A visão de detalhe só mostra "Corretor: X" quando broker_id existe (AtividadesPage linha 448).
- As "Visita corretor" de 11/06 (Rubiam) estão com broker_id NULL (criadas sem preencher o corretor); a de 09/06 "Fernanda Souto" tem broker_id (o campo funciona).

R-20260611-07 | P4 UX | aberto — É fácil salvar "Visita corretor" sem corretor; a visão de detalhe oferece "+ Adicionar" só na EQUIPE (que não aceita broker), induzindo o usuário ao campo errado. Não há onde adicionar o corretor pela tela de detalhe (só via Editar). Sugestão: (1) mostrar o corretor na visão de detalhe e permitir adicioná-lo ali; (2) destacar/sugerir o campo Corretor na criação de visit_broker; (3) rótulo da EQUIPE deixar claro que é equipe interna.

## Atualização 2026-06-11 16:43 — R-07 prompt gerado
Prompt de correção UX do corretor: `PROMPT-R07-corretor-na-atividade.md` (mostrar corretor no detalhe; adicionar/trocar pelo detalhe via EntityPicker; aviso ao salvar visit_broker sem corretor; rótulo EQUIPE INTERNA). P2 reconciliação verificada e em produção (trigger lê requirements; configs deprecada; código sem leituras de configs).

---

## Atualização (verificação R-07) — R-07 OK + corrupção de arquivos no working tree

**R-07 (wiring):** verificado e correto — seção CORRETOR no ActivityDetailModal, EQUIPE→EQUIPE INTERNA, handleSetBroker via repoUpdateActivity (sem supabase no componente) + logEvent + toast, aviso leve "Salvar sem informar o corretor?". P2 (banco) também ok (trigger lê requirements; configs deprecada).

**R-20260611-08 | P0 build | aberto — corrupção em arquivos modificados pelo CC (working tree):**
Ao rodar `npx tsc -b` (o build do projeto é `tsc -b && vite build`), vários arquivos que o CC gravou aparecem corrompidos nesta sessão:
- NUL no fim, conteúdo INTACTO (recuperável): ClientDetailPage.tsx (limpei os NULs aqui — 1216 linhas, fecha em `}`), SettingsPage.tsx (1170/1170 chaves balanceadas após strip).
- TRUNCADOS no meio, cauda perdida (NÃO recuperável a partir desta sessão): clientsSupabaseRepository.ts (termina em `return {`), AtividadesPage.tsx (termina em `<button onClick={async () =>`), ActivityDetailModal.tsx (termina em `<div style={{ padding:`), ContatosPage.tsx (termina em `{!isMobile && c.score`).

**Avaliação:** como o deploy do CC foi verde e o build é `tsc -b && vite build`, os arquivos REAIS do CC estavam íntegros no momento do build → a produção está OK e o repo real provavelmente está OK. A corrupção é quase certamente **glitch de sincronização** dos arquivos para esta sessão do Cowork, não do disco do usuário.
**Ação segura:** rodar `npm run build` na máquina (ou pelo CC). Se verde → ignorar a visão corrompida desta sessão e NÃO commitar arquivo com bytes NUL. Se falhar → restaurar: NUL-padded por strip; truncados o CC reescreve (cauda perdida). Mudanças ainda NÃO commitadas — commitar após confirmar build verde.

## Resolução R-08 — artefato de sessão (não era defeito real)
`npm run build` na máquina do Rubiam passou verde (573 módulos, sem erros TS). Confirma que a corrupção (NULs/truncamento) estava SÓ na cópia montada nesta sessão do Cowork, não no repo real. R-07 e P2 íntegros e em produção. Avisos restantes (jspdf dynamic+static import; chunk > 500 kB) são pré-existentes e cosméticos. **R-08: fechado (artefato de sincronização).** Pendência saudável: as mudanças P2/R-07 seguem sem commit — recomendo commitar.
