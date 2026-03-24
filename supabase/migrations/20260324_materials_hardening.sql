-- ============================================
-- NEXA: Endurecimento da tabela materials
-- Data: 2026-03-24
-- ============================================

-- 1. Índices para performance (account_id + development_id são filtros frequentes)
CREATE INDEX IF NOT EXISTS idx_materials_account_id ON public.materials(account_id);
CREATE INDEX IF NOT EXISTS idx_materials_development_id ON public.materials(development_id);
CREATE INDEX IF NOT EXISTS idx_materials_account_development ON public.materials(account_id, development_id);

-- 2. Policy DELETE (hoje não existe — operação bloqueada por RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'materials' AND policyname = 'materials_delete'
  ) THEN
    CREATE POLICY materials_delete ON public.materials
      FOR DELETE
      USING (
        account_id IN (
          SELECT uaa.account_id FROM public.user_account_access uaa
          WHERE uaa.user_id = auth.uid()
        )
      );
  END IF;
END $$;
