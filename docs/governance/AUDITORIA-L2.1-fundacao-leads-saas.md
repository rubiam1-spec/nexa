# AUDITORIA — L2.1: Fundação do Módulo de Leads SaaS

**Data:** 2026-07-13 · **Decisão de produto:** Rubiam + arquiteto
**Objetivo:** fundação de dados + área de configuração self-service para leads
multicanal. **NADA muda no comportamento atual da Bomm** (webhook fixed). A Edge
`receive-lead` **NÃO** foi tocada (é a L2.2).

## Diagnóstico (via MCP + leitura de código)

- `account_settings` já tinha `lead_distribution_enabled` + `lead_distribution_eligible_roles`.
- `clients` já tinha `qualified_at`, `converted_at`, `first_contact_at`, `origin`,
  `utm_*`, `assignment_type` — faltavam `campaign_id`, `discarded_at`, `discard_reason`.
- `lead_distribution` faltava `paused`; `webhook_endpoints` faltavam
  `distribution_mode`, `provider_adapter`, `fallback_assigned_to`.
- **RPCs `assign_next_lead_consultant(p_account_id,p_development_id)` e
  `distribute_lead(p_client_id)` existem** → reutilizadas, não recriadas.
- SettingsPage **já tinha a aba "Leads"** (WebhooksPanel + LeadDistributionPanel) e
  `leadDistributionSupabaseRepository` — **evoluídos**, não recriados.

## Parte 1 + 1b — Schema (aplicado via apply_migration `l2_1_leads_saas_foundation`)

Aditivo/idempotente. Verificado: 3 cols em `webhook_endpoints`, `lead_distribution.paused`,
3 cols em `clients` (campaign_id/discarded_at/discard_reason), 3 tabelas novas
(`lead_campaigns`, `lead_origins`, `webhook_events`), **14 origens seed/conta**,
índices, **5 policies RLS** (SELECT p/ membros; escrita owner/director/manager;
`webhook_events` sem escrita p/ usuários — só service role). **Migração de estado:**
`webhook_endpoints.distribution_mode='fixed'` onde há responsável fixo → **Bomm
preservado** (1 canal `fixed`, 0 não-fixed). Arquivo versionado em
`supabase/migrations/20260713_l2_1_leads_saas_foundation.sql`. Sem drop/perda —
rollback = drop dos novos objetos.

**Parte 1b — carimbos de funil (regra no repositório, NÃO na UI):** `transitionLead`
carimba `first_contact_at` (→in_service), `qualified_at` (→qualified),
`converted_at` (→converted, já existia) e `discarded_at`+`discard_reason`
(→discarded). Guarda `.is(col, null)` = **primeira ocorrência vale, nunca
sobrescreve**. Best-effort (não bloqueia a transição). Backfill honesto: leads
antigos ficam nulos.

## Camada de dados (regra fora da UI)

- `leadOriginsSupabaseRepository` (+ `useLeadOrigins`), `leadCampaignsSupabaseRepository`
  (+ `useLeadCampaigns`, contagem de leads em **batch**), `leadDistribution`
  ganhou `paused`/`setParticipantPaused`. `clients` select/tipo/mapRow ganharam
  `campaignId`. `useLeads` expõe `campaigns` (id+nome).

## Parte 2 — Configurações → Leads (MANAGER_ROLES)

- **2c Origens:** catálogo `lead_origins` (listar/criar custom/ativar-desativar;
  is_system só desativa).
- **2d Campanhas & Ações:** CRUD `lead_campaigns` (nome, canal=origem, empreendimento,
  período, casamento UTM, budget, ativa) + contagem de leads vinculados.
- **2b Distribuição:** toggle **pausa individual** por participante (férias/afastamento).

## Parte 3 — Integração leve

- Tela de Leads: **filtro por campanha** (dropdown) + **chip de campanha** no card.
- (Cadastro manual origem/campanha + wizard rico de Canais 2a: ver "Próximo passo".)

## L2.1b — Canais (wizard) + cadastro manual + aviso de roleta (2026-07-13)

**Diagnóstico da `receive-lead` (SEM alterar):** o canal é identificado por
`api_key` (plaintext) via header `x-api-key` **ou** `?key=` → lookup em
`webhook_endpoints.api_key`. `api_key_encrypted` **não é usada** (nem app nem
ingestão); único trigger em webhook_endpoints é `updated_at` (sem sync de chave).
**Decisão:** "Regenerar chave" é **seguro e habilitado** — a coluna regenerada
(`api_key`) é exatamente a que a receive-lead valida; sem desync. Confirmação
DUPLA + aviso de que a chave atual para na hora protege a intenção. URL de
entrega: `RECEIVE_LEAD_URL?key=<api_key>` (ou header x-api-key).

- **Camada de dados:** `webhookChannelsSupabaseRepository` (+ `useLeadChannels`)
  com os novos campos, `PROVIDER_ADAPTERS`/`DISTRIBUTION_MODES`, instruções por
  plataforma, `regenerateApiKey` (hex 32B client-side), delete-só-se-nunca-recebeu.
- **UI:** wizard 3 passos (plataforma → config → entrega), lista enriquecida,
  editar/desativar/regenerar; **campos origem+campanha no cadastro manual**;
  **aviso** "roleta ativa sem canal round_robin" na Distribuição.
- `receive-lead` **intocada** (L2.2). `source` guarda o slug da origem
  (compatível com o insert atual da receive-lead).

## DoD
- tsc 0 · build verde · check:contracts · suíte. RLS em toda tabela nova; toda query
  por account_id. Zero regra em componente. Modais fecham e permanecem; toast sempre.
- **Deploy:** push ff `8da5a7f..940270d` → main → **`dpl_3QFEx8Dq6znY3NTMcaDZ92bquKdt` READY**
  (production, sha `940270d`, `app.nexacomercial.com.br`).
- **Prova de bundle** (`/assets/index-7lGKP9FV.js`): `Todas as campanhas` 1× (filtro
  Leads), `Nova campanha` 1×, `Nova origem` 1× (Configurações → Leads).
- **RLS confirmada** (pg_policies): lead_campaigns/lead_origins com SELECT (membros)
  + ALL (owner/director/manager); webhook_events só SELECT (escrita = service role).
  Rollback do schema = drop dos novos objetos (aditivo, sem perda). Rollback do app
  = instant rollback p/ `dpl_88VCvJVS` (`ed8afee`).

### Checklist para o Rubiam
- Configurações → Leads visível só p/ owner/director/manager; broker/consultant não vê
  (e RLS bloqueia INSERT via API).
- Criar origem custom · criar/editar campanha com UTM · pausar membro do rodízio
  reflete no banco.
- Tela de Leads: filtrar por campanha; chip no card. Comportamento Bomm intacto.
