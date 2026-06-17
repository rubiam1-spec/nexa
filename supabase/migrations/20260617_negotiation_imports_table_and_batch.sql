-- Importador de negociações (Camada 1, sem IA) — tabela de jobs + rastreio de lote.
-- Aplicada via Supabase em 2026-06-17 (projeto phpbsiyxwsbzeevqgixk). Idempotente.

-- 1. negotiation_imports job table (mirrors contact_imports)
CREATE TABLE IF NOT EXISTS public.negotiation_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  development_id uuid REFERENCES developments(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  sheet_name text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reviewing','committed','undone','failed')),
  total_rows integer DEFAULT 0,
  imported_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  duplicate_count integer DEFAULT 0,
  column_mapping jsonb,
  status_mapping jsonb,
  default_values jsonb DEFAULT '{}'::jsonb,
  duplicate_strategy text DEFAULT 'skip' CHECK (duplicate_strategy IN ('skip','update','create')),
  permuta_out_of_vgv boolean DEFAULT true,
  errors jsonb DEFAULT '[]'::jsonb,
  imported_by uuid REFERENCES profiles(id),
  committed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.negotiation_imports ENABLE ROW LEVEL SECURITY;

-- 2. batch tracking column on negotiations
ALTER TABLE public.negotiations ADD COLUMN IF NOT EXISTS import_batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_negotiations_import_batch
  ON public.negotiations (import_batch_id) WHERE import_batch_id IS NOT NULL;

-- 3. FK from negotiations.import_batch_id -> negotiation_imports
ALTER TABLE public.negotiations DROP CONSTRAINT IF EXISTS negotiations_import_batch_fk;
ALTER TABLE public.negotiations
  ADD CONSTRAINT negotiations_import_batch_fk
  FOREIGN KEY (import_batch_id) REFERENCES public.negotiation_imports(id) ON DELETE SET NULL;

-- 4. RLS: SELECT a membros da conta; escrita a MANAGER_ROLES (owner/director/manager)
DROP POLICY IF EXISTS neg_imports_select ON public.negotiation_imports;
CREATE POLICY neg_imports_select ON public.negotiation_imports FOR SELECT TO authenticated
  USING (account_id IN (SELECT account_id FROM user_account_access WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS neg_imports_write ON public.negotiation_imports;
CREATE POLICY neg_imports_write ON public.negotiation_imports FOR ALL TO authenticated
  USING (account_id IN (SELECT account_id FROM user_account_access WHERE user_id = auth.uid() AND role IN ('owner','director','manager')))
  WITH CHECK (account_id IN (SELECT account_id FROM user_account_access WHERE user_id = auth.uid() AND role IN ('owner','director','manager')));
