-- Importador de negociações — correção do desfazer (undo) + seed de contatos.
-- Aplicada em produção via MCP em 2026-07-18 (projeto phpbsiyxwsbzeevqgixk).
--
-- Contexto:
--   1) SEED (registrado na 20260617): o commit passou a inserir o contato histórico
--      como status 'active' + qualification_status 'converted' + converted_at
--      backdatado, e a negociação importada com owner_profile_id NULL. Assim o
--      importador NUNCA injeta contatos na fila de qualificação de leads.
--   2) UNDO (esta migração): substitui o desfazer "soft" (marcava CANCELLED) por um
--      hard-delete transacional COM TRAVA. Se qualquer negociação do lote já tiver
--      registros reais downstream (propostas, reservas, vendas, atividades, fila de
--      unidade, histórico de unidade, interações), o undo ABORTA e nada é destruído.
--      Contatos e corretores são SEMPRE preservados (protege a fila de leads) — o
--      retorno informa quantos foram mantidos.
--
-- Contrato de retorno: { deleted, clients_kept, brokers_kept }.
-- Códigos de exceção tratados no frontend (PT-BR): batch_not_found,
-- not_authenticated, forbidden, batch_not_committed, batch_has_downstream_records.

CREATE OR REPLACE FUNCTION public.undo_negotiation_import(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor        uuid := auth.uid();
  v_account      uuid;
  v_batch_status text;
  v_downstream   jsonb;
  v_deleted      int := 0;
  v_clients_kept int := 0;
  v_brokers_kept int := 0;
BEGIN
  SELECT account_id, status INTO v_account, v_batch_status
  FROM negotiation_imports WHERE id = p_batch_id;

  IF v_account IS NULL THEN
    RAISE EXCEPTION 'batch_not_found';
  END IF;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_account_access
    WHERE user_id = v_actor AND account_id = v_account
      AND role IN ('owner','director','manager')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_batch_status <> 'committed' THEN
    RAISE EXCEPTION 'batch_not_committed:%', v_batch_status;
  END IF;

  -- Trava de segurança: nenhuma negociação do lote pode ter registros
  -- reais downstream. Se tiver, o undo aborta — nada é destruído.
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'proposals',            NULLIF((SELECT count(*) FROM proposals            p WHERE p.negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id)), 0),
    'reservations',         NULLIF((SELECT count(*) FROM reservations         r WHERE r.negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id)), 0),
    'reservation_requests', NULLIF((SELECT count(*) FROM reservation_requests rr WHERE rr.negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id)), 0),
    'sales',                NULLIF((SELECT count(*) FROM sales                s WHERE s.negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id)), 0),
    'activities',           NULLIF((SELECT count(*) FROM activities           a WHERE a.negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id)), 0),
    'contact_interactions', NULLIF((SELECT count(*) FROM contact_interactions ci WHERE ci.negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id)), 0),
    'unit_queue_entries',   NULLIF((SELECT count(*) FROM unit_queue_entries   uq WHERE uq.negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id)), 0),
    'unit_history',         NULLIF((SELECT count(*) FROM unit_history         uh WHERE uh.negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id)), 0)
  )) INTO v_downstream;

  IF v_downstream <> '{}'::jsonb THEN
    RAISE EXCEPTION 'batch_has_downstream_records:%', v_downstream::text;
  END IF;

  -- Contagens informativas (preservados, não deletados)
  SELECT count(DISTINCT client_id), count(DISTINCT broker_id)
    INTO v_clients_kept, v_brokers_kept
  FROM negotiations
  WHERE import_batch_id = p_batch_id;

  -- Deleção na ordem das dependências (parties cai por CASCADE;
  -- pipeline_simulations é ON DELETE SET NULL)
  DELETE FROM negotiation_history
  WHERE negotiation_id IN (SELECT id FROM negotiations WHERE import_batch_id = p_batch_id);

  WITH del AS (
    DELETE FROM negotiations WHERE import_batch_id = p_batch_id RETURNING id
  ) SELECT count(*) INTO v_deleted FROM del;

  UPDATE negotiation_imports SET status = 'undone' WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'deleted', v_deleted,
    'clients_kept', v_clients_kept,
    'brokers_kept', v_brokers_kept
  );
END;
$$;

REVOKE ALL ON FUNCTION public.undo_negotiation_import(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.undo_negotiation_import(uuid) TO authenticated;
