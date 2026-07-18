-- Importador de negociações (Camada 1, sem IA) — RPC de commit transacional + desfazer.
-- Aplicada via Supabase em 2026-06-17 (projeto phpbsiyxwsbzeevqgixk).
-- Triggers de negotiation_parties (primary_buyer / spouse) criam parties no INSERT;
-- por isso NÃO inserimos parties manualmente. negotiation_history não tem trigger no
-- INSERT, então é inserido explicitamente com action='imported'.
--
-- Ajuste 2026-07-18 (aplicado em produção via MCP, ver 20260718_fix_negotiation_import_undo_and_seed.sql):
--   • seed de clientes do importador → status 'active' + qualification_status 'converted'
--     + converted_at backdatado (contato histórico nunca entra na fila de leads);
--   • owner_profile_id da negociação importada → NULL (importado não tem "dono").
--   • A função undo abaixo é a versão ORIGINAL (soft/CANCELLED) e foi SUPERSEDIDA
--     pela 20260718 (hard-delete com trava de downstream). Mantida aqui como histórico.

CREATE OR REPLACE FUNCTION public.commit_negotiation_import(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor      uuid := auth.uid();
  v_account    uuid := (p_payload->>'account_id')::uuid;
  v_dev        uuid := NULLIF(p_payload->>'development_id','')::uuid;
  v_dupe       text := COALESCE(p_payload->>'duplicate_strategy','skip');
  v_batch      uuid;
  rec          jsonb;
  v_idx        int := 0;
  v_imported   int := 0;
  v_skipped    int := 0;
  v_duplicate  int := 0;
  v_errcount   int := 0;
  v_errors     jsonb := '[]'::jsonb;
  v_client     uuid;
  v_broker     uuid;
  v_unit       uuid;
  v_status     text;
  v_temp       text;
  v_created    timestamptz;
  v_name       text;
  v_phone      text;
  v_cpf        text;
  v_existing   uuid;
  v_skip_ins   boolean;
  v_neg        uuid;
BEGIN
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

  INSERT INTO negotiation_imports (
    account_id, development_id, file_name, sheet_name, status,
    total_rows, column_mapping, status_mapping, default_values,
    duplicate_strategy, permuta_out_of_vgv, imported_by
  ) VALUES (
    v_account, v_dev,
    COALESCE(p_payload->>'file_name','(sem nome)'),
    NULLIF(p_payload->>'sheet_name',''),
    'reviewing',
    COALESCE((p_payload->>'total_rows')::int, 0),
    p_payload->'column_mapping',
    p_payload->'status_mapping',
    COALESCE(p_payload->'default_values','{}'::jsonb),
    v_dupe,
    COALESCE((p_payload->>'permuta_out_of_vgv')::boolean, true),
    v_actor
  ) RETURNING id INTO v_batch;

  FOR rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'rows','[]'::jsonb))
  LOOP
    v_idx := v_idx + 1;
    BEGIN
      v_skip_ins := false;
      v_name  := NULLIF(btrim(rec->>'client_name'),'');
      v_phone := NULLIF(btrim(rec->>'client_phone'),'');
      v_cpf   := NULLIF(btrim(rec->>'client_cpf'),'');
      v_unit  := NULLIF(rec->>'unit_id','')::uuid;
      v_temp  := NULLIF(rec->>'temperature','');
      v_status := rec->>'status';
      v_created := NULLIF(rec->>'created_at','')::timestamptz;

      IF v_status IS NULL OR v_status NOT IN
        ('OPEN','IN_PROGRESS','PROPOSAL','RESERVATION','WON','LOST','CANCELLED') THEN
        v_status := 'OPEN';
      END IF;

      -- vínculo explícito a contato existente tem prioridade; senão find-or-create
      v_client := NULLIF(rec->>'client_id','')::uuid;
      IF v_client IS NULL AND v_cpf IS NOT NULL THEN
        SELECT id INTO v_client FROM clients
        WHERE account_id = v_account AND cpf = v_cpf LIMIT 1;
      END IF;
      IF v_client IS NULL AND v_name IS NOT NULL THEN
        SELECT id INTO v_client FROM clients
        WHERE account_id = v_account AND lower(name) = lower(v_name) LIMIT 1;
      END IF;
      IF v_client IS NULL AND v_name IS NOT NULL THEN
        -- Cliente histórico: já convertido por definição (tem negociação).
        -- Nunca entra na fila de qualificação de leads.
        INSERT INTO clients (
          account_id, name, phone, cpf, development_id, created_by,
          origin, status, qualification_status, converted_at
        )
        VALUES (
          v_account, v_name, v_phone, v_cpf, v_dev, v_actor,
          'import', 'active', 'converted', COALESCE(v_created, now())
        )
        RETURNING id INTO v_client;
      END IF;

      v_broker := NULLIF(rec->>'broker_id','')::uuid;
      IF v_broker IS NULL AND NULLIF(btrim(rec->>'broker_name'),'') IS NOT NULL THEN
        SELECT id INTO v_broker FROM brokers
        WHERE account_id = v_account AND lower(name) = lower(btrim(rec->>'broker_name')) LIMIT 1;
        IF v_broker IS NULL THEN
          INSERT INTO brokers (account_id, name, brokerage_id, brokerage_name, status, created_by, approval_status)
          VALUES (v_account, btrim(rec->>'broker_name'),
                  NULLIF(rec->>'brokerage_id','')::uuid,
                  NULLIF(btrim(rec->>'brokerage_name'),''),
                  'active', v_actor, 'approved')
          RETURNING id INTO v_broker;
        END IF;
      END IF;

      IF v_dupe <> 'create' THEN
        SELECT id INTO v_existing FROM negotiations
        WHERE account_id = v_account
          AND client_id IS NOT DISTINCT FROM v_client
          AND broker_id IS NOT DISTINCT FROM v_broker
          AND created_at::date IS NOT DISTINCT FROM v_created::date
        LIMIT 1;
        IF v_existing IS NOT NULL THEN
          v_duplicate := v_duplicate + 1;
          IF v_dupe = 'skip' THEN
            v_skipped := v_skipped + 1;
            v_skip_ins := true;
          ELSIF v_dupe = 'update' THEN
            UPDATE negotiations
              SET status = v_status, temperature = COALESCE(v_temp, temperature), updated_at = now()
              WHERE id = v_existing;
            v_skip_ins := true;
          END IF;
        END IF;
      END IF;

      IF NOT v_skip_ins THEN
        INSERT INTO negotiations (
          account_id, development_id, client_id, broker_id, unit_id,
          status, temperature, created_at, updated_at, owner_profile_id, import_batch_id
        ) VALUES (
          v_account, v_dev, v_client, v_broker, v_unit,
          v_status, v_temp, COALESCE(v_created, now()), now(), NULL, v_batch
        ) RETURNING id INTO v_neg;

        INSERT INTO negotiation_history (negotiation_id, from_status, to_status, action, performed_by, created_at)
        VALUES (v_neg, NULL, v_status, 'imported', v_actor, COALESCE(v_created, now()));

        v_imported := v_imported + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errcount := v_errcount + 1;
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', SQLERRM);
    END;
  END LOOP;

  UPDATE negotiation_imports SET
    status = 'committed',
    imported_count = v_imported,
    skipped_count = v_skipped,
    duplicate_count = v_duplicate,
    error_count = v_errcount,
    errors = (SELECT jsonb_agg(e) FROM (SELECT e FROM jsonb_array_elements(v_errors) e LIMIT 100) s),
    committed_at = now()
  WHERE id = v_batch;

  RETURN jsonb_build_object(
    'batch_id', v_batch,
    'imported', v_imported,
    'skipped', v_skipped,
    'duplicates', v_duplicate,
    'errors_count', v_errcount,
    'errors', v_errors
  );
END;
$$;

-- Desfazer: arquiva (CANCELLED) o lote inteiro e marca o job como 'undone'. Sem hard-delete.
CREATE OR REPLACE FUNCTION public.undo_negotiation_import(p_batch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_account uuid;
  v_affected int;
BEGIN
  SELECT account_id INTO v_account FROM negotiation_imports WHERE id = p_batch_id;
  IF v_account IS NULL THEN
    RAISE EXCEPTION 'batch_not_found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_account_access
    WHERE user_id = v_actor AND account_id = v_account
      AND role IN ('owner','director','manager')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH upd AS (
    UPDATE negotiations
      SET status = 'CANCELLED', lost_reason = COALESCE(lost_reason,'Importação desfeita'), updated_at = now()
      WHERE import_batch_id = p_batch_id AND status <> 'CANCELLED'
      RETURNING id
  ) SELECT count(*) INTO v_affected FROM upd;

  UPDATE negotiation_imports SET status = 'undone' WHERE id = p_batch_id;

  RETURN jsonb_build_object('archived', v_affected);
END;
$$;

REVOKE ALL ON FUNCTION public.commit_negotiation_import(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.undo_negotiation_import(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.commit_negotiation_import(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_negotiation_import(uuid) TO authenticated;
