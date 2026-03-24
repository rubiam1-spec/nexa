create table if not exists public.negotiation_history (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations (id) on delete cascade,
  from_status text null,
  to_status text not null,
  action text not null,
  performed_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_negotiation_history_negotiation_id
  on public.negotiation_history (negotiation_id);
