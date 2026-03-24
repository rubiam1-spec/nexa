create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  development_id uuid not null references public.developments (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  amount numeric(14,2) not null,
  status text not null check (status in ('CREATED')),
  created_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sales_negotiation_id
  on public.sales (negotiation_id);

create index if not exists idx_sales_account_id
  on public.sales (account_id);

create unique index if not exists uq_sales_per_negotiation
  on public.sales (negotiation_id);
