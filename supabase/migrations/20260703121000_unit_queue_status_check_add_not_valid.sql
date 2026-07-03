-- Fase 3 — Etapa 5 Bloco 2 (parte 1/2): adiciona a CHECK constraint de status de
-- unit_queue_entries em NOT VALID. Completa o invariante "o banco se defende" em
-- TODAS as tabelas do fluxo comercial (última sem CHECK de status).
--
-- Padrão idêntico ao das migrations da Etapa 2 (20260702120000/120100): ADD ... NOT VALID
-- adquire lock curto e não varre linhas; a validação (varredura) fica na parte 2/2.
--
-- Valores = fonte única src/domain/status/unitQueue.ts (UNIT_QUEUE_DB_VALUES, Fase 3 —
-- Etapa 1). Dados confirmados 100% canônicos antes do DDL (SELECT status,count(*): só
-- 'waiting'). Toda escrita da fila passa por unitQueueSupabaseRepository (Bloco 1), que
-- grava lowercase canônico; nenhuma função/trigger do Postgres escreve nesta tabela.
-- Idempotente: só adiciona se a constraint ainda não existir.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unit_queue_entries_status_check') THEN
    ALTER TABLE public.unit_queue_entries
      ADD CONSTRAINT unit_queue_entries_status_check
      CHECK (status IN ('active','promoted','cancelled','waiting','removed','expired'))
      NOT VALID;
  END IF;
END $$;
