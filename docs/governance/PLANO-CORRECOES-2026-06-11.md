# NEXA — Plano de Correção (achados dos robôs · 2026-06-11)

Fonte dos achados: `docs/governance/ROBOS-NEXA.md`. Fatos de banco pré-confirmados via Supabase advisors (project `phpbsiyxwsbzeevqgixk`).

## Ordem de execução recomendada

1. **PROMPT 1 — R-01 Segurança (P0)** — primeiro, antes de qualquer feature. Mexe em RLS, funções e views.
2. **PROMPT 2 — R-02 Performance (P4)** — índices e RLS init plan. Ganhos baratos, baixo risco.
3. **PROMPT 3 — R-04/R-05 Documentação** — alinhar CLAUDE.md à realidade (evolução intencional).
4. **R-03** — apenas mapeado (inventário no ledger). Correção incremental em fase futura.

> Como usar: abra o Claude Code no VS Code, na raiz do repo, e cole UM prompt por vez. Aguarde terminar e validar antes do próximo.

---

# PROMPT 1 — R-01 Segurança (P0)

```
Contexto: projeto NEXA (React+TS+Vite / Supabase). Supabase project_id: phpbsiyxwsbzeevqgixk.
Esta é uma correção de SEGURANÇA detectada pelos advisors do Supabase. NÃO toque em frontend.
Aplique como migrations SQL incrementais e seguras. Faça UMA migration por tema. Nome de migration único.

DIAGNÓSTICO OBRIGATÓRIO (antes de escrever qualquer SQL):
- Liste as policies atuais das tabelas `auth_audit_log` e `intelligence_alerts`:
  SELECT polname, cmd, qual, with_check, roles FROM pg_policies WHERE tablename IN ('auth_audit_log','intelligence_alerts');
- Confirme a definição das views: SELECT definition FROM pg_views WHERE viewname IN ('vw_aniversariantes','operational_alerts');
- Confirme os grants atuais das funções de cripto: 
  SELECT proname, proacl FROM pg_proc WHERE proname IN ('decrypt_pii','decrypt_financial','encrypt_pii','encrypt_financial');
- NÃO altere nada que dependa de: handle_new_user (trigger inviolável), get_user_account_ids e user_has_role (usadas na RLS — precisam continuar executáveis por authenticated).

TEMA 1 — Views SECURITY DEFINER (2 ERRORs). PostgreSQL 17 suporta security_invoker.
  ALTER VIEW public.vw_aniversariantes SET (security_invoker = on);
  ALTER VIEW public.operational_alerts SET (security_invoker = on);
  Depois confirme que as telas que consomem essas views (aniversariantes/Relacionamento e alertas operacionais) continuam retornando dados para um usuário autenticado real. Se a view passar a retornar vazio por RLS, ajuste as policies das tabelas-base, NÃO reverta para definer.

TEMA 2 — Funções de cripto executáveis por anon/authenticated (risco de exposição de PII/financeiro).
  Estas funções só devem rodar via trigger (SECURITY DEFINER) ou service_role, NUNCA por cliente:
  REVOKE EXECUTE ON FUNCTION public.decrypt_pii(text) FROM anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.decrypt_financial(text) FROM anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.encrypt_financial(text) FROM anon, authenticated;
  (Confirme as assinaturas reais via pg_proc antes — ajuste os tipos de argumento se diferentes.)
  NÃO revogue execute de get_user_account_ids, user_has_role, handle_new_user nem dos triggers trigger_encrypt_*.

TEMA 3 — search_path mutável (29 funções). Endurecer fixando o search_path.
  Para CADA função abaixo, rode: ALTER FUNCTION public.<nome>(<args reais>) SET search_path = public, pg_temp;
  (descubra os args reais com: SELECT oid::regprocedure FROM pg_proc WHERE proname='<nome>';)
  Funções: calculate_negotiation_score, enforce_activity_initial_status, expire_overdue_activities,
  fn_interaction_to_activity, generate_short_slug, get_user_account_ids, log_auth_event, log_sensitive_access,
  login_mural_items_set_updated_at, negotiation_parties_set_updated_at, recalculate_scores, score_to_temperature,
  seed_client_documents, seed_documents_for_new_client, social_extract_handles, social_posts_published_at_trigger,
  social_set_updated_at, test_rls_segregation, trg_document_requirements_updated_at, trigger_encrypt_broker_pii,
  trigger_encrypt_client_pii, update_central_prefs_updated_at, update_client_interaction_timestamp,
  update_clients_updated_at, update_leads_updated_at, update_negotiation_activity_timestamp,
  update_negotiation_stage_timestamp, update_tpp_updated_at, update_webhook_endpoints_updated_at.
  Use `public, pg_temp` (não use '' vazio, pois várias referenciam tabelas no schema public sem prefixo).
  Após alterar, teste o fluxo que usa cada gatilho crítico (criação de cliente → seed de documentos; encrypt nos triggers).

TEMA 4 — Policies always-true (USING true) em auth_audit_log e intelligence_alerts.
  Substitua por policies escopadas por conta. Mantenha INSERT por trigger/service_role.
  - auth_audit_log: SELECT apenas para owner/director da conta dona da linha (via get_user_account_ids() + checagem de role). Log é imutável: sem UPDATE/DELETE para usuários.
  - intelligence_alerts: SELECT filtrado por account_id IN (SELECT get_user_account_ids()) e, quando houver target_profile_id, restrito ao próprio usuário ou a manager/director.
  Diagnostique a policy atual antes e preserve a inserção feita por funções SECURITY DEFINER.

TEMA 5 — Proteção de senha vazada (auth_leaked_password_protection desligado).
  Isto NÃO é SQL — é configuração de Auth. Habilite em Authentication → Policies (ou via Management API):
  "Leaked password protection" = ON. Apenas registre no PR que precisa ser ligado no painel.

TEMA 6 — Buckets públicos com listagem (development-maps, logos, materials, properties).
  Regra do projeto: bucket de documentos de cliente é PRIVADO (confirme que client-documents NÃO está público — não aparece na lista, então só verifique).
  logos e materials podem ser públicos de propósito (assets). Para development-maps e properties, avalie sensibilidade.
  Onde o acesso público por URL é necessário mas a LISTAGEM não, mantenha leitura pública e bloqueie listagem anônima com policy de storage (impedir SELECT de listagem por anon no bucket), SEM quebrar as URLs públicas já usadas. NÃO torne privado um bucket de assets sem checar onde as URLs são consumidas no front.

VALIDAÇÃO:
1. Re-rodar os advisors de segurança e confirmar que os 2 ERROR sumiram e os WARN de search_path/cripto caíram.
2. Login real funciona; tela de aniversariantes e alertas operacionais retornam dados.
3. Criação de cliente ainda dispara seed de documentos e encrypt dos PII.
4. Build passa.

Aplique as migrations via Supabase. Reporte cada tema e o resultado dos advisors depois.
```

**O que testar depois:** login, tela de aniversariantes (Relacionamento), alertas operacionais, criar um cliente de teste e ver os documentos semeados + PII criptografado.

---

# PROMPT 2 — R-02 Performance (P4)

```
Contexto: projeto NEXA / Supabase project_id phpbsiyxwsbzeevqgixk. Correção de PERFORMANCE dos advisors. Só SQL, sem frontend.
Migrations incrementais e seguras (CREATE INDEX IF NOT EXISTS / DROP INDEX IF EXISTS). Uma migration por tema.

TEMA 1 — Índices em foreign keys sem cobertura (50). Crie um índice btree para cada FK abaixo (CREATE INDEX IF NOT EXISTS, nome no padrão idx_<tabela>_<coluna>):
  activities(broker_id), activities(column_id), activity_kinds(development_id),
  banner_templates(created_by), banner_templates(development_id), board_columns(account_id), board_columns(development_id),
  cadence_settings(account_id), central_preferences(account_id), contact_imports(account_id), contact_imports(imported_by),
  contact_interactions(performed_by), daily_briefings(development_id), daily_briefings(target_profile_id),
  document_requirements(account_id), document_requirements(document_type_id), intelligence_alerts(development_id),
  login_mural_items(created_by), message_templates(created_by), message_templates(development_id),
  negotiation_parties(created_by), notifications(sender_id),
  pipeline_simulations(broker_id), pipeline_simulations(client_id), pipeline_simulations(development_id), pipeline_simulations(unit_id),
  share_links(created_by), simulation_group_items(simulation_id), simulation_groups(broker_id), simulation_groups(created_by), simulation_groups(development_id),
  social_bookmarks(account_id), social_comments(account_id), social_mentions(account_id), social_posts(hidden_by), social_reactions(account_id), social_user_preferences(account_id),
  third_party_properties(approved_by), third_party_properties(corretor_responsavel_id), third_party_properties(created_by),
  third_party_property_documents(account_id), third_party_property_photos(account_id),
  unit_queue_entries(broker_id), unit_queue_entries(client_id), user_central_preferences(account_id),
  webhook_endpoints(created_by), webhook_endpoints(default_assigned_to), webhook_endpoints(default_development_id),
  weekly_plans(development_id), weekly_plans(published_by).
  Confirme o nome exato da coluna em cada FK antes (information_schema.key_column_usage) — alguns fkeys podem ter nome de coluna diferente do fkey.

TEMA 2 — Índices duplicados (Duplicate Index). Em public.client_documents há 3 índices idênticos: idx_client_docs_client, idx_client_documents_client, idx_client_documents_client_id. Mantenha UM (o mais usado/idiomático) e dropie os outros dois com DROP INDEX IF EXISTS. Rode o advisor de duplicados de novo para pegar o segundo caso.

TEMA 3 — Auth RLS Initialization Plan (103 policies). As policies usam auth.uid()/current_setting diretamente, recalculando por linha. Reescreva envolvendo em subselect:
  - Troque `auth.uid()` por `(select auth.uid())` e `auth.jwt()` por `(select auth.jwt())` dentro das policies.
  Diagnostique primeiro: SELECT schemaname, tablename, polname, qual, with_check FROM pg_policies WHERE schemaname='public';
  Reescreva CREATE OR REPLACE/DROP+CREATE cada policy afetada preservando EXATAMENTE a lógica (só o wrap muda). Não altere quem pode o quê — apenas a forma da expressão. Teste a segregação multi-tenant depois (um usuário da conta A não vê dados da conta B).

TEMA 4 — Multiple Permissive Policies (18). Tabelas com policies permissivas redundantes para o mesmo role/ação (ex: activity_templates tem at_select e at_write ambos permissivos para SELECT/anon). Consolide em uma única policy por ação/role quando forem equivalentes, preservando o comportamento. Liste os 18 casos com o advisor e trate um a um — NÃO remova policy que mude o resultado de acesso.

TEMA 5 — Unused Index (153): NÃO dropar agora. Muitos índices são novos e ainda não acumularam estatística de uso. Apenas gere um relatório (lista) e registre para revisão futura — dropar índice não usado é decisão posterior, com base em uso real ao longo do tempo.

VALIDAÇÃO:
1. Re-rodar advisor de performance: FKs sem índice → 0; duplicados → 0; auth init plan e multiple permissive caíram.
2. Segregação multi-tenant intacta (RLS continua barrando conta cruzada).
3. Build passa.

Aplique as migrations. Reporte contagem antes/depois dos advisors.
```

**O que testar depois:** listagens grandes (negociações, contatos, atividades) seguem corretas; usuário de uma conta não enxerga dados de outra.

---

# PROMPT 3 — R-04/R-05 Alinhamento de documentação (evolução intencional)

```
Contexto: projeto NEXA. Tarefa de DOCUMENTAÇÃO apenas — NÃO mexer em código nem banco.
Decisão do dono: a camada de regra de negócio vive nos HOOKS de aplicação (não em src/domain/services, que está vazio),
e a persistência é Supabase-only (não há repositórios mock; o contrato "mock + Supabase" foi superado).
Isso é evolução consolidada, não um defeito. Ajuste a documentação para refletir a realidade, sem reescrever a visão.

Edite o CLAUDE.md da raiz:
- Seção 4 (Arquitetura de pastas): note que `domain/` concentra entities/enums/rules; a regra de negócio operacional vive em hooks/serviços de aplicação dentro de `modules/*/hooks`. `domain/services` é opcional e hoje não utilizado.
- Seção 11 (Contratos de dados): registre que a persistência é Supabase-only; repositórios mock são opcionais e não são mantidos. O contrato único é o `*SupabaseRepository`. Remova a obrigatoriedade de paridade mock×Supabase, mantendo a regra de "repositório retorna Domain Entity, nunca Row".
- Acrescente uma nota datada (2026-06-11) em rodapé: "Ajuste de aderência: regra em hooks; Supabase-only. Decidido por Rubiam."

Faça o mesmo alinhamento, se necessário, em docs/governance/AGENT-RULES.md onde mencionar camada de serviços/mocks.
NÃO altere o fluxo comercial, perfis, RLS, nem qualquer regra de negócio. Só texto de documentação.

VALIDAÇÃO: diff apenas em arquivos .md. Nenhuma mudança em src/ ou supabase/.
```

**Observação:** este é doc-only e reversível. Se preferir, eu mesmo aplico esse ajuste no CLAUDE.md sem passar pelo Claude Code — é só avisar.

---

# R-03 — UI acessando Supabase direto (mapeado, correção adiada)

Inventário completo (26 componentes .tsx) está em `ROBOS-NEXA.md`. Abordagem futura: incremental, módulo a módulo, movendo as chamadas `supabase.from/rpc` dos `.tsx` para hooks/repositórios, começando pelos módulos do fluxo comercial (negociacoes, clientes). O arquivo `simulador/pages/SimuladorPage.backup.tsx` é morto e pode ser removido.
