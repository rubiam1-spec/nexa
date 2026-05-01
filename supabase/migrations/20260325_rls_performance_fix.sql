-- ============================================
-- NEXA: RLS Performance Fix
-- Substituir auth.uid() por (select auth.uid()) em todas as policies
-- Isso evita reavaliação da função para cada linha da tabela
-- Data: 2026-03-25
-- ============================================

-- ═══════════════════════════════════════
-- accounts
-- ═══════════════════════════════════════
ALTER POLICY accounts_select ON public.accounts
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = accounts.id));

ALTER POLICY accounts_insert ON public.accounts
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = accounts.id));

ALTER POLICY accounts_update ON public.accounts
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = accounts.id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = accounts.id));

-- ═══════════════════════════════════════
-- profiles
-- ═══════════════════════════════════════
ALTER POLICY profiles_select_own ON public.profiles
  USING (id = (select auth.uid()));

ALTER POLICY profiles_insert_own ON public.profiles
  WITH CHECK (id = (select auth.uid()));

ALTER POLICY profiles_update_own ON public.profiles
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- ═══════════════════════════════════════
-- user_account_access
-- ═══════════════════════════════════════
ALTER POLICY uaa_select_own ON public.user_account_access
  USING (user_id = (select auth.uid()));

ALTER POLICY uaa_insert_own ON public.user_account_access
  WITH CHECK (user_id = (select auth.uid()));

ALTER POLICY uaa_update_own ON public.user_account_access
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ═══════════════════════════════════════
-- developments
-- ═══════════════════════════════════════
ALTER POLICY developments_select ON public.developments
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = developments.account_id));

ALTER POLICY developments_insert ON public.developments
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = developments.account_id));

ALTER POLICY developments_update ON public.developments
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = developments.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = developments.account_id));

-- ═══════════════════════════════════════
-- development_settings
-- ═══════════════════════════════════════
ALTER POLICY development_settings_select ON public.development_settings
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = development_settings.account_id));

ALTER POLICY development_settings_insert ON public.development_settings
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = development_settings.account_id));

ALTER POLICY development_settings_update ON public.development_settings
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = development_settings.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = development_settings.account_id));

-- ═══════════════════════════════════════
-- account_settings
-- ═══════════════════════════════════════
ALTER POLICY account_settings_select ON public.account_settings
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = account_settings.account_id));

ALTER POLICY account_settings_insert ON public.account_settings
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = account_settings.account_id));

ALTER POLICY account_settings_update ON public.account_settings
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = account_settings.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = account_settings.account_id));

-- ═══════════════════════════════════════
-- units
-- ═══════════════════════════════════════
ALTER POLICY units_select ON public.units
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = units.account_id));

ALTER POLICY units_insert ON public.units
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = units.account_id));

ALTER POLICY units_update ON public.units
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = units.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = units.account_id));

-- ═══════════════════════════════════════
-- clients
-- ═══════════════════════════════════════
ALTER POLICY clients_select ON public.clients
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = clients.account_id));

ALTER POLICY clients_insert ON public.clients
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = clients.account_id));

ALTER POLICY clients_update ON public.clients
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = clients.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = clients.account_id));

-- ═══════════════════════════════════════
-- brokers
-- ═══════════════════════════════════════
ALTER POLICY brokers_select ON public.brokers
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = brokers.account_id));

ALTER POLICY brokers_insert ON public.brokers
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = brokers.account_id));

ALTER POLICY brokers_update ON public.brokers
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = brokers.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = brokers.account_id));

-- ═══════════════════════════════════════
-- brokerages
-- ═══════════════════════════════════════
ALTER POLICY brokerages_select ON public.brokerages
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = brokerages.account_id));

ALTER POLICY brokerages_insert ON public.brokerages
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = brokerages.account_id));

ALTER POLICY brokerages_update ON public.brokerages
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = brokerages.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = brokerages.account_id));

-- ═══════════════════════════════════════
-- negotiations
-- ═══════════════════════════════════════
ALTER POLICY negotiations_select ON public.negotiations
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = negotiations.account_id));

ALTER POLICY negotiations_insert ON public.negotiations
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = negotiations.account_id));

ALTER POLICY negotiations_update ON public.negotiations
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = negotiations.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = negotiations.account_id));

-- ═══════════════════════════════════════
-- proposals
-- ═══════════════════════════════════════
ALTER POLICY proposals_select ON public.proposals
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = proposals.account_id));

ALTER POLICY proposals_insert ON public.proposals
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = proposals.account_id));

ALTER POLICY proposals_update ON public.proposals
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = proposals.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = proposals.account_id));

-- ═══════════════════════════════════════
-- reservation_requests
-- ═══════════════════════════════════════
ALTER POLICY reservation_requests_select ON public.reservation_requests
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = reservation_requests.account_id));

ALTER POLICY reservation_requests_insert ON public.reservation_requests
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = reservation_requests.account_id));

ALTER POLICY reservation_requests_update ON public.reservation_requests
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = reservation_requests.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = reservation_requests.account_id));

-- ═══════════════════════════════════════
-- reservations
-- ═══════════════════════════════════════
ALTER POLICY reservations_select ON public.reservations
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = reservations.account_id));

ALTER POLICY reservations_insert ON public.reservations
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = reservations.account_id));

ALTER POLICY reservations_update ON public.reservations
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = reservations.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = reservations.account_id));

-- ═══════════════════════════════════════
-- sales
-- ═══════════════════════════════════════
ALTER POLICY sales_select ON public.sales
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = sales.account_id));

ALTER POLICY sales_insert ON public.sales
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = sales.account_id));

ALTER POLICY sales_update ON public.sales
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = sales.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = sales.account_id));

-- ═══════════════════════════════════════
-- unit_queue_entries
-- ═══════════════════════════════════════
ALTER POLICY unit_queue_entries_select ON public.unit_queue_entries
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = unit_queue_entries.account_id));

ALTER POLICY unit_queue_entries_insert ON public.unit_queue_entries
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = unit_queue_entries.account_id));

ALTER POLICY unit_queue_entries_update ON public.unit_queue_entries
  USING (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = unit_queue_entries.account_id))
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid()) AND uaa.account_id = unit_queue_entries.account_id));

-- ═══════════════════════════════════════
-- negotiation_history
-- ═══════════════════════════════════════
ALTER POLICY negotiation_history_select ON public.negotiation_history
  USING (EXISTS (SELECT 1 FROM negotiations n JOIN user_account_access uaa ON uaa.account_id = n.account_id WHERE uaa.user_id = (select auth.uid()) AND n.id = negotiation_history.negotiation_id));

ALTER POLICY negotiation_history_insert ON public.negotiation_history
  WITH CHECK (EXISTS (SELECT 1 FROM negotiations n JOIN user_account_access uaa ON uaa.account_id = n.account_id WHERE uaa.user_id = (select auth.uid()) AND n.id = negotiation_history.negotiation_id));

ALTER POLICY negotiation_history_update ON public.negotiation_history
  USING (EXISTS (SELECT 1 FROM negotiations n JOIN user_account_access uaa ON uaa.account_id = n.account_id WHERE uaa.user_id = (select auth.uid()) AND n.id = negotiation_history.negotiation_id))
  WITH CHECK (EXISTS (SELECT 1 FROM negotiations n JOIN user_account_access uaa ON uaa.account_id = n.account_id WHERE uaa.user_id = (select auth.uid()) AND n.id = negotiation_history.negotiation_id));

-- ═══════════════════════════════════════
-- unit_history
-- ═══════════════════════════════════════
ALTER POLICY unit_history_select ON public.unit_history
  USING (EXISTS (SELECT 1 FROM units u JOIN user_account_access uaa ON uaa.account_id = u.account_id WHERE uaa.user_id = (select auth.uid()) AND u.id = unit_history.unit_id));

ALTER POLICY unit_history_insert ON public.unit_history
  WITH CHECK (EXISTS (SELECT 1 FROM units u JOIN user_account_access uaa ON uaa.account_id = u.account_id WHERE uaa.user_id = (select auth.uid()) AND u.id = unit_history.unit_id));

ALTER POLICY unit_history_update ON public.unit_history
  USING (EXISTS (SELECT 1 FROM units u JOIN user_account_access uaa ON uaa.account_id = u.account_id WHERE uaa.user_id = (select auth.uid()) AND u.id = unit_history.unit_id))
  WITH CHECK (EXISTS (SELECT 1 FROM units u JOIN user_account_access uaa ON uaa.account_id = u.account_id WHERE uaa.user_id = (select auth.uid()) AND u.id = unit_history.unit_id));

-- ═══════════════════════════════════════
-- materials
-- ═══════════════════════════════════════
ALTER POLICY materials_select ON public.materials
  USING (EXISTS (SELECT 1 FROM user_account_access WHERE user_account_access.user_id = (select auth.uid()) AND user_account_access.account_id = materials.account_id));

ALTER POLICY materials_insert ON public.materials
  WITH CHECK (EXISTS (SELECT 1 FROM user_account_access WHERE user_account_access.user_id = (select auth.uid()) AND user_account_access.account_id = materials.account_id));

ALTER POLICY materials_update ON public.materials
  USING (EXISTS (SELECT 1 FROM user_account_access WHERE user_account_access.user_id = (select auth.uid()) AND user_account_access.account_id = materials.account_id));

ALTER POLICY materials_delete ON public.materials
  USING (account_id IN (SELECT uaa.account_id FROM user_account_access uaa WHERE uaa.user_id = (select auth.uid())));
