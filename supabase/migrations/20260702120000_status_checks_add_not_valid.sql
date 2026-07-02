-- Fase 3 — Etapa 2 (parte 1/2): adiciona CHECK constraints de status em NOT VALID.
--
-- Padrão de referência para tabelas com VOLUME: ADD CONSTRAINT ... NOT VALID adquire
-- lock curto e NÃO varre as linhas existentes; a validação (varredura) fica em uma
-- migration separada (VALIDATE CONSTRAINT), que usa SHARE UPDATE EXCLUSIVE e não trava
-- escrita concorrente. Aqui as tabelas são pequenas e não faz diferença prática, mas
-- o padrão fica registrado.
--
-- Valores = fonte única src/domain/status/*.ts (Fase 3 — Etapa 1). Os dados já estão
-- 100% canônicos (confirmado na Fase 1/2: zero violações), então a VALIDATE seguinte passa.
-- Idempotente: só adiciona se a constraint ainda não existir.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposals_status_check') THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_status_check
      CHECK (status IN ('draft','sent','under_analysis','accepted','rejected','expired','counter_proposal'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_status_check') THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_status_check
      CHECK (status IN ('requested','approved','rejected','active','cancelled','expired','converted'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservation_requests_status_check') THEN
    ALTER TABLE public.reservation_requests
      ADD CONSTRAINT reservation_requests_status_check
      CHECK (status IN ('requested','approved','rejected','cancelled'))
      NOT VALID;
  END IF;

  -- IMPORTANTE (sales): a escrita principal desta tabela virá do IMPORTADOR de
  -- negociações, que hoje é WIP. Os valores abaixo são exatamente os de
  -- src/domain/status/sale.ts (fonte única). O importador DEVE derivar o status
  -- dessa fonte única (SaleStatus/SaleDbStatus) — se gravar um literal fora desta
  -- lista, a linha nascerá violando esta constraint. Ver AUDITORIA_NEGOCIACOES.md.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_status_check') THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_status_check
      CHECK (status IN ('created','awaiting_documents','awaiting_contract','awaiting_payment','completed','cancelled'))
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_simulations_status_check') THEN
    ALTER TABLE public.pipeline_simulations
      ADD CONSTRAINT pipeline_simulations_status_check
      CHECK (status IN ('ativa','convertida','expirada','cancelada'))
      NOT VALID;
  END IF;
END $$;
