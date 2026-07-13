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

## Próximo passo (L2.1b — schema já pronto, sem novo DDL)

- **2a wizard de Canais** completo: seleção de plataforma → `provider_adapter`,
  `distribution_mode` (fixed/round_robin/unassigned) + `fallback_assigned_to`,
  entrega com URL/chave e instruções por plataforma, regenerar chave.
- Campos **origem (catálogo) + campanha** no formulário de cadastro manual.

## DoD
- tsc 0 · build verde · check:contracts · suíte. RLS em toda tabela nova; toda query
  por account_id. Zero regra em componente. Modais fecham e permanecem; toast sempre.
- **Deploy + prova de bundle:** (rodapé abaixo).

### Checklist para o Rubiam
- Configurações → Leads visível só p/ owner/director/manager; broker/consultant não vê
  (e RLS bloqueia INSERT via API).
- Criar origem custom · criar/editar campanha com UTM · pausar membro do rodízio
  reflete no banco.
- Tela de Leads: filtrar por campanha; chip no card. Comportamento Bomm intacto.
