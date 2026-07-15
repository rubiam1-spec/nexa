-- Cap E-mail Parte 3/4 — Preferências por usuário + infra do digest (E-mail 2).
-- ADITIVO (CREATE-only + cron). Nenhuma tabela existente é alterada.
-- Dump-alvo de central_preferences (tabela de prefs vizinha) salvo em
-- docs/governance/dump-alvo-central_preferences-2026-07-15.json.

-- 1) Preferências de notificação por usuário. Defaults ON (ausência de linha = ligado).
--    Global por usuário (v1). Convite/recuperação IGNORAM estas preferências.
create table if not exists public.notification_preferences (
  profile_id       uuid primary key,
  immediate_emails boolean not null default true,
  daily_digest     boolean not null default true,
  updated_at       timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Cada usuário gerencia SOMENTE a própria linha (profiles.id = auth.uid()).
-- Edges usam service_role e ignoram RLS (leem todas as linhas).
create policy notif_prefs_select_own on public.notification_preferences
  for select using (profile_id = auth.uid());
create policy notif_prefs_insert_own on public.notification_preferences
  for insert with check (profile_id = auth.uid());
create policy notif_prefs_update_own on public.notification_preferences
  for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- 2) Dedup do digest — impede reenvio no mesmo dia por destinatário.
create table if not exists public.lead_digest_log (
  recipient_id uuid not null,
  account_id   uuid not null,
  digest_date  date not null default (now() at time zone 'utc')::date,
  sent_at      timestamptz not null default now(),
  primary key (recipient_id, digest_date)
);

-- Apenas service_role (Edge) escreve/lê; anon/auth sem acesso (RLS sem policy = deny).
alter table public.lead_digest_log enable row level security;

-- 3) Agendamento diário ~08h BRT (11h UTC). Mesmo padrão dos jobs existentes
--    (sem Authorization; daily-lead-digest tem verify_jwt=false e sem gate interno).
select cron.schedule(
  'daily-lead-digest-morning',
  '0 11 * * *',
  $cron$
  select net.http_post(
    url := 'https://phpbsiyxwsbzeevqgixk.supabase.co/functions/v1/daily-lead-digest',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
