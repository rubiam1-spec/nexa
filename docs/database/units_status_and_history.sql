alter table public.units
  drop constraint if exists units_status_check;

alter table public.units
  add constraint units_status_check
  check (status in ('DISPONIVEL', 'EM_NEGOCIACAO', 'RESERVADO', 'VENDIDO'));

create table if not exists public.unit_history (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  negotiation_id uuid null references public.negotiations (id) on delete set null,
  from_status text null,
  to_status text not null,
  action text not null,
  performed_by uuid null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_unit_history_unit_id
  on public.unit_history (unit_id);
