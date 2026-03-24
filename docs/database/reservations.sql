create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_request_id uuid not null references public.reservation_requests (id) on delete cascade,
  negotiation_id uuid not null references public.negotiations (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  development_id uuid not null references public.developments (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  status text not null check (status in ('ACTIVE', 'CANCELLED', 'EXPIRED')),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reservations_negotiation_id
  on public.reservations (negotiation_id);

create index if not exists idx_reservations_account_id
  on public.reservations (account_id);

create unique index if not exists uq_reservations_active_per_unit
  on public.reservations (unit_id)
  where status = 'ACTIVE';
