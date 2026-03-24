create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  development_id uuid not null references public.developments (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  client_id uuid null references public.clients (id) on delete set null,
  broker_id uuid null references public.brokers (id) on delete set null,
  title text not null,
  amount numeric(14,2) not null,
  status text not null check (status in ('DRAFT', 'SENT', 'UNDER_ANALYSIS', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proposals_negotiation_id
  on public.proposals (negotiation_id);
