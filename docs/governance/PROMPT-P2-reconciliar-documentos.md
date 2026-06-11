# PROMPT P2 — Reconciliar os modelos de documentos (fonte única)

Gerado em 2026-06-11. Fatos de banco/código pré-confirmados via Supabase MCP. Objetivo: eliminar a divergência entre os 3 jeitos de definir "quais documentos", tornando `document_type_catalog` (dicionário) + `document_requirements` (o que é exigido, por empreendimento + party_role) a FONTE ÚNICA, e aposentando `document_type_configs`. Sem migrar arquivos já enviados.

## Decisão de comportamento (confirme com Rubiam se quiser mudar)
Hoje todo cliente novo recebe um checklist de documentos no momento da criação (trigger). Vamos PRESERVAR isso, mas semeando a partir de `document_requirements` (party_role='primary_buyer'). Quando o cliente tem `development_id`, usa os requisitos daquele empreendimento; quando não tem (lead cru), usa o conjunto distinto de requisitos primary_buyer da conta (fallback), para não regredir a experiência.

---

```
FEATURE: Reconciliar modelos de configuração de documentos do NEXA (P2 — endurecimento de consistência).
Projeto NEXA (React+TS+Vite / Supabase). project_id: phpbsiyxwsbzeevqgixk.
Account Bomm: 16d4b82f-880f-4818-bb07-93c3b606f982. Development Vivendas: 909c1a4a-165b-483f-9ebb-73929c01bf70.

REGRAS DO PROJETO: regra de negócio fora de componente React; UI não acessa Supabase direto (hook/repositório); filtra account_id; SECURITY DEFINER mantém search_path fixo; numeric vem como string; sem navigate('/')/reload após salvar; toast; createPortal em modal; zero emojis; tokens T.*. Deploy: npm run build && npx vercel deploy --prod --yes.

DIAGNÓSTICO OBRIGATÓRIO (confirme antes de codar):
- document_type_catalog (DICIONÁRIO, 11 linhas): id (text, ex: rg_frente, rg_verso, cpf, comprovante_endereco, comprovante_renda, comprovante_renda_coobrigado, certidao_casamento, procuracao, declaracao_estado_civil, irpf, documento_complementar), label, category, applies_to_pessoa_tipo (text[] PF/PJ), display_order, is_active.
- document_requirements (FONTE DO QUE É EXIGIDO, 19 linhas p/ Bomm): account_id, development_id, party_role ('primary_buyer'|'spouse'|'co_obligor'|'attorney_in_fact'), document_type_id (= catalog.id), is_required, display_order. Constraint UNIQUE (development_id, party_role, document_type_id). Já há repositório/hook: src/infra/repositories/documentRequirementsSupabaseRepository.ts e src/modules/empreendimentos/hooks/useDocumentRequirements.ts.
- document_type_configs (MODELO ANTIGO A DEPRECAR, 7 linhas): account_id, name (= catalog.id), label, required, active, sort_order, person_type ('fisica'|'both'). É o que a UI da ficha do contato lê hoje e o que o trigger usa.
- client_documents (47 linhas; document_type já = catalog.id em 100% das linhas — NÃO migrar): client_id, account_id, document_type, label, is_required, status ('pending'|'sent'|'uploaded'|'approved'|'rejected'), file_url, storage_path, mime_type, reviewed_by, reviewed_at, rejection_reason. NÃO tem coluna party_role (checklist é por cliente). Bucket client-documents é PRIVADO (signed URLs) — manter.
- clients: tem development_id, marital_status, conjuge_cpf (cônjuge). NÃO tem coluna PF/PJ — tratar como pessoa física.
- 3 fontes divergentes hoje: trigger seed_documents_for_new_client (lê document_type_configs); seed_client_documents (lista HARDCODED, irpf=true); seed_default_document_requirements (semeia document_requirements, irpf=false). Canônico = document_requirements.
- Confirme onde document_type_configs é lido/escrito no código: provavelmente src/modules/clientes/pages/ClientDetailPage.tsx e src/modules/configuracoes/pages/SettingsPage.tsx (grep "document_type_configs").

PARTE 1 — BANCO (migrations incrementais, uma por tema, nomes únicos; manter SECURITY DEFINER + search_path=public,pg_temp):

1.1 Reescrever o trigger seed_documents_for_new_client() para semear client_documents a partir de document_requirements (party_role='primary_buyer') + join document_type_catalog (label/category), em vez de document_type_configs. Manter idempotência (só semeia se o cliente ainda não tem client_documents). Lógica:
   - Se NEW.development_id NOT NULL: usar requirements WHERE development_id = NEW.development_id AND party_role='primary_buyer'.
   - Se NEW.development_id IS NULL: fallback = requisitos primary_buyer distintos da conta (SELECT DISTINCT document_type_id, max(is_required) ... WHERE account_id = NEW.account_id AND party_role='primary_buyer'), para não regredir o comportamento atual.
   - Inserir (account_id, client_id, document_type=catalog.id, label=catalog.label, is_required, status='pending').

1.2 Reescrever seed_client_documents(p_client_id, p_account_id) para também ler de document_requirements (primary_buyer) + catalog (remover a lista hardcoded), mantendo a assinatura e a idempotência. (É chamada na criação de cliente em alguns caminhos — confirme e mantenha compatível.)

1.3 NÃO dropar document_type_configs (segurança de dados). Adicionar comentário/observação de deprecação: COMMENT ON TABLE document_type_configs IS 'DEPRECATED 2026-06-11: substituída por document_type_catalog + document_requirements. Não ler/escrever.'. (Drop fica para uma etapa futura, após validação em produção.)

PARTE 2 — FRONTEND:

2.1 Tirar a lógica de documentos de ClientDetailPage.tsx (que hoje acessa Supabase direto — é um dos casos R-03). Criar src/modules/clientes/hooks/useClientDocuments.ts (+ usar/estender um repositório em infra) cuidando de: carregar client_documents do cliente; carregar a lista de requisitos (primary_buyer) do empreendimento do cliente via documentRequirementsSupabaseRepository/useDocumentRequirements + catalog; upload (bucket privado + signed URL como hoje); aprovar/recusar (com motivo); aprovação em lote; remover. O componente só renderiza e chama o hook.
   - O CHECKLIST (lista de tipos exigidos) passa a vir de document_requirements(primary_buyer, development do cliente) + catalog — NÃO mais de document_type_configs. Se o cliente não tem development, usar o fallback de conta (igual ao trigger) ou exibir aviso.
   - Preservar 100% o comportamento de upload/revisão/notificações já existente.

2.2 SettingsPage.tsx — repontar a administração de "tipos de documento" para gerenciar document_requirements (por empreendimento + party_role) + catalog, reaproveitando useDocumentRequirements, e remover o editor de document_type_configs. Acesso só owner/director/manager (usePermissions()). Persistência via hook/repositório, nunca no componente.

2.3 Remover quaisquer outros reads/writes de document_type_configs no código (grep e limpar). Garantir que nenhum caminho do app leia mais a tabela deprecada.

VALIDAÇÃO (testes de escrita em transação com ROLLBACK — não alterar produção):
1. Inserir cliente novo COM development_id=909c1a4a → trigger semeia client_documents a partir dos requisitos primary_buyer da Vivendas (rg_frente/rg_verso/cpf/comprovante_endereco/comprovante_renda obrigatórios; irpf opcional), label vindo do catálogo. Conferir is_required coerente com requirements (irpf=false).
2. Inserir cliente novo SEM development_id → trigger usa o fallback de conta (mesma lista primary_buyer) — não fica sem checklist.
3. Os 47 client_documents existentes permanecem intactos (document_type segue casando com catalog).
4. Checklist na ficha do contato renderiza a partir de requirements+catalog; upload, aprovar, recusar e lote continuam funcionando.
5. grep no código: zero leituras/escritas de document_type_configs (fora de migração/COMMENT).
6. Build verde; tsc limpo.

DEPLOY: npm run build && npx vercel deploy --prod --yes
Reporte: migrations aplicadas, arquivos alterados (diff por camada), resultado das validações, e o que permanece provisório (ex: tabela document_type_configs mantida mas deprecada; drop futuro).
```

## O que testar depois (você)
Abrir a ficha de um contato com empreendimento e ver o checklist; criar um contato novo e confirmar que os documentos certos aparecem; em Configurações, ajustar um requisito por empreendimento/papel e ver refletir no checklist.
