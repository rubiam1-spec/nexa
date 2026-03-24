create table if not exists public.reservation_requests (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations (id) on delete cascade,
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  development_id uuid not null references public.developments (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  status text not null check (status in ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requested_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reservation_requests_negotiation_id
  on public.reservation_requests (negotiation_id);

create index if not exists idx_reservation_requests_account_id
  on public.reservation_requests (account_id);

create unique index if not exists uq_reservation_requests_open_per_negotiation
  on public.reservation_requests (negotiation_id)
  where status = 'REQUESTED';
