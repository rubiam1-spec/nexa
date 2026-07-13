-- L2.1 — Fundação do Módulo de Leads SaaS (aditivo, idempotente). Aplicado via
-- Supabase apply_migration (l2_1_leads_saas_foundation) em 2026-07-13.
-- Ver docs/governance/AUDITORIA-L2.1-fundacao-leads-saas.md. NÃO altera comportamento atual.
ALTER TABLE webhook_endpoints
  ADD COLUMN IF NOT EXISTS distribution_mode text NOT NULL DEFAULT 'fixed'
    CHECK (distribution_mode IN ('fixed','round_robin','unassigned')),
  ADD COLUMN IF NOT EXISTS provider_adapter text NOT NULL DEFAULT 'generic'
    CHECK (provider_adapter IN ('generic','landing_page','google_lead_form','meta_bridge','tiktok','linkedin','taboola')),
  ADD COLUMN IF NOT EXISTS fallback_assigned_to uuid REFERENCES profiles(id);
ALTER TABLE lead_distribution ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS lead_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id),
  development_id uuid REFERENCES developments(id),
  name text NOT NULL, channel text NOT NULL, utm_campaign_match text,
  starts_at date, ends_at date, budget numeric, active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_lead_campaigns_account ON lead_campaigns(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_campaigns_utm ON lead_campaigns(account_id, utm_campaign_match) WHERE utm_campaign_match IS NOT NULL;
CREATE TABLE IF NOT EXISTS lead_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id),
  slug text NOT NULL, label text NOT NULL, is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true, created_at timestamptz DEFAULT now(), UNIQUE (account_id, slug));
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL REFERENCES accounts(id),
  endpoint_id uuid REFERENCES webhook_endpoints(id), raw_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','duplicate','failed')),
  client_id uuid REFERENCES clients(id), error text, created_at timestamptz DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_webhook_events_endpoint ON webhook_events(endpoint_id, created_at DESC);
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES lead_campaigns(id),
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz, ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS discarded_at timestamptz, ADD COLUMN IF NOT EXISTS discard_reason text;
CREATE INDEX IF NOT EXISTS idx_clients_campaign ON clients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clients_lead_funnel ON clients(account_id, created_at) WHERE origin IS NOT NULL;
-- Seed + RLS + migração de estado: ver a migration aplicada (apply_migration). Este arquivo
-- documenta o DDL estrutural; seed/RLS idempotentes rodaram junto no apply_migration.
