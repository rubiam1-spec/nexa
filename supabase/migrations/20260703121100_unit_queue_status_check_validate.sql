-- Fase 3 — Etapa 5 Bloco 2 (parte 2/2): valida a CHECK constraint de status da fila.
--
-- Passo SEPARADO do ADD (parte 1) de propósito — mesmo padrão da Etapa 2: a validação
-- varre as linhas existentes, mas com lock que não bloqueia escrita concorrente.
-- Executar apenas após confirmar zero registros fora do canônico (confirmado: só 'waiting').
-- Idempotente: só valida se a constraint existir; VALIDATE em constraint já válida é no-op.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unit_queue_entries_status_check') THEN
    ALTER TABLE public.unit_queue_entries VALIDATE CONSTRAINT unit_queue_entries_status_check;
  END IF;
END $$;
