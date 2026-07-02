-- Fase 3 — Etapa 2 (parte 2/2): valida as CHECK constraints de status.
--
-- Passo SEPARADO do ADD (parte 1) de propósito — é o padrão para tabelas com volume:
-- a validação varre as linhas existentes, mas com lock que não bloqueia escrita.
-- Executar apenas após confirmar zero registros fora do canônico (confirmado na Fase 1/2).
-- Idempotente: só valida se a constraint existir; VALIDATE em constraint já válida é no-op.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposals_status_check') THEN
    ALTER TABLE public.proposals VALIDATE CONSTRAINT proposals_status_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_status_check') THEN
    ALTER TABLE public.reservations VALIDATE CONSTRAINT reservations_status_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservation_requests_status_check') THEN
    ALTER TABLE public.reservation_requests VALIDATE CONSTRAINT reservation_requests_status_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_status_check') THEN
    ALTER TABLE public.sales VALIDATE CONSTRAINT sales_status_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_simulations_status_check') THEN
    ALTER TABLE public.pipeline_simulations VALIDATE CONSTRAINT pipeline_simulations_status_check;
  END IF;
END $$;
