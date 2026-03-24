create table if not exists public.unit_queue_entries (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  negotiation_id uuid not null references public.negotiations (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  development_id uuid not null references public.developments (id) on delete cascade,
  requested_by uuid null references public.profiles (id) on delete set null,
  status text not null check (status in ('ACTIVE', 'PROMOTED', 'CANCELLED')),
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_unit_queue_entries_unit_id
  on public.unit_queue_entries (unit_id);

create index if not exists idx_unit_queue_entries_account_id
  on public.unit_queue_entries (account_id);

create unique index if not exists uq_unit_queue_open_per_negotiation
  on public.unit_queue_entries (negotiation_id)
  where status in ('ACTIVE', 'PROMOTED');
