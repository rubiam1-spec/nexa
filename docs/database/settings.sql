create table if not exists public.account_settings (
  account_id uuid primary key references public.accounts (id) on delete cascade,
  reservation_duration_hours integer not null default 48,
  require_accepted_proposal_for_reservation_request boolean not null default true,
  require_complete_client_data_for_reservation_request boolean not null default false,
  queue_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.account_settings
  drop constraint if exists account_settings_reservation_duration_hours_check;

alter table public.account_settings
  add constraint account_settings_reservation_duration_hours_check
  check (reservation_duration_hours > 0);

create table if not exists public.development_settings (
  development_id uuid primary key references public.developments (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  reservation_duration_hours integer null,
  require_accepted_proposal_for_reservation_request boolean null,
  require_complete_client_data_for_reservation_request boolean null,
  queue_enabled boolean null,
  updated_at timestamptz not null default now()
);

alter table public.development_settings
  drop constraint if exists development_settings_reservation_duration_hours_check;

alter table public.development_settings
  add constraint development_settings_reservation_duration_hours_check
  check (
    reservation_duration_hours is null or reservation_duration_hours > 0
  );

create index if not exists idx_development_settings_account_id
  on public.development_settings (account_id);
