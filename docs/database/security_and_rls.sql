create or replace function public.nexa_has_account_access(target_account_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_account_access access
    where access.user_id = auth.uid()
      and access.account_id = target_account_id
  );
$$;

create or replace function public.nexa_has_account_role(
  target_account_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_account_access access
    where access.user_id = auth.uid()
      and access.account_id = target_account_id
      and access.role = any(allowed_roles)
  );
$$;

alter table public.reservation_requests enable row level security;
alter table public.reservations enable row level security;
alter table public.sales enable row level security;
alter table public.unit_queue_entries enable row level security;
alter table public.account_settings enable row level security;
alter table public.development_settings enable row level security;
alter table public.negotiation_history enable row level security;
alter table public.unit_history enable row level security;

drop policy if exists reservation_requests_select_policy on public.reservation_requests;
create policy reservation_requests_select_policy
  on public.reservation_requests
  for select
  using (public.nexa_has_account_access(account_id));

drop policy if exists reservation_requests_insert_policy on public.reservation_requests;
create policy reservation_requests_insert_policy
  on public.reservation_requests
  for insert
  with check (
    public.nexa_has_account_role(
      account_id,
      array['director', 'manager', 'commercial_consultant', 'broker']
    )
  );

drop policy if exists reservation_requests_update_policy on public.reservation_requests;
create policy reservation_requests_update_policy
  on public.reservation_requests
  for update
  using (
    public.nexa_has_account_role(
      account_id,
      array['director', 'manager', 'administrative']
    )
  )
  with check (
    public.nexa_has_account_role(
      account_id,
      array['director', 'manager', 'administrative']
    )
  );

drop policy if exists reservations_select_policy on public.reservations;
create policy reservations_select_policy
  on public.reservations
  for select
  using (public.nexa_has_account_access(account_id));

drop policy if exists reservations_write_policy on public.reservations;
create policy reservations_write_policy
  on public.reservations
  for all
  using (
    public.nexa_has_account_role(
      account_id,
      array['director', 'manager', 'administrative']
    )
  )
  with check (
    public.nexa_has_account_role(
      account_id,
      array['director', 'manager', 'administrative']
    )
  );

drop policy if exists sales_select_policy on public.sales;
create policy sales_select_policy
  on public.sales
  for select
  using (public.nexa_has_account_access(account_id));

drop policy if exists sales_insert_policy on public.sales;
create policy sales_insert_policy
  on public.sales
  for insert
  with check (
    public.nexa_has_account_role(account_id, array['director', 'manager'])
  );

drop policy if exists unit_queue_entries_select_policy on public.unit_queue_entries;
create policy unit_queue_entries_select_policy
  on public.unit_queue_entries
  for select
  using (
    public.nexa_has_account_role(account_id, array['director', 'manager']) or
    (
      public.nexa_has_account_role(
        account_id,
        array['commercial_consultant', 'broker']
      )
      and requested_by = auth.uid()
    )
  );

drop policy if exists unit_queue_entries_insert_policy on public.unit_queue_entries;
create policy unit_queue_entries_insert_policy
  on public.unit_queue_entries
  for insert
  with check (
    public.nexa_has_account_role(
      account_id,
      array['director', 'manager', 'commercial_consultant', 'broker']
    )
  );

drop policy if exists unit_queue_entries_update_policy on public.unit_queue_entries;
create policy unit_queue_entries_update_policy
  on public.unit_queue_entries
  for update
  using (
    public.nexa_has_account_role(account_id, array['director', 'manager'])
  )
  with check (
    public.nexa_has_account_role(account_id, array['director', 'manager'])
  );

drop policy if exists account_settings_select_policy on public.account_settings;
create policy account_settings_select_policy
  on public.account_settings
  for select
  using (public.nexa_has_account_access(account_id));

drop policy if exists account_settings_update_policy on public.account_settings;
create policy account_settings_update_policy
  on public.account_settings
  for all
  using (
    public.nexa_has_account_role(account_id, array['director', 'manager'])
  )
  with check (
    public.nexa_has_account_role(account_id, array['director', 'manager'])
  );

drop policy if exists development_settings_select_policy on public.development_settings;
create policy development_settings_select_policy
  on public.development_settings
  for select
  using (public.nexa_has_account_access(account_id));

drop policy if exists development_settings_update_policy on public.development_settings;
create policy development_settings_update_policy
  on public.development_settings
  for all
  using (
    public.nexa_has_account_role(account_id, array['director', 'manager'])
  )
  with check (
    public.nexa_has_account_role(account_id, array['director', 'manager'])
  );

drop policy if exists negotiation_history_select_policy on public.negotiation_history;
create policy negotiation_history_select_policy
  on public.negotiation_history
  for select
  using (
    exists (
      select 1
      from public.negotiations negotiation
      where negotiation.id = negotiation_history.negotiation_id
        and public.nexa_has_account_access(negotiation.account_id)
    )
  );

drop policy if exists negotiation_history_insert_policy on public.negotiation_history;
create policy negotiation_history_insert_policy
  on public.negotiation_history
  for insert
  with check (
    exists (
      select 1
      from public.negotiations negotiation
      where negotiation.id = negotiation_history.negotiation_id
        and public.nexa_has_account_access(negotiation.account_id)
    )
  );

drop policy if exists unit_history_select_policy on public.unit_history;
create policy unit_history_select_policy
  on public.unit_history
  for select
  using (
    exists (
      select 1
      from public.units unit
      where unit.id = unit_history.unit_id
        and public.nexa_has_account_access(unit.account_id)
    )
  );

drop policy if exists unit_history_insert_policy on public.unit_history;
create policy unit_history_insert_policy
  on public.unit_history
  for insert
  with check (
    exists (
      select 1
      from public.units unit
      where unit.id = unit_history.unit_id
        and public.nexa_has_account_access(unit.account_id)
    )
  );
