
-- Add skill_category to trades
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS skill_category text;

-- Document templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('worker','advance','blacklist','project','other')),
  description text,
  content text NOT NULL DEFAULT '',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read templates" ON public.document_templates;
CREATE POLICY "staff read templates" ON public.document_templates FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "admin manage templates" ON public.document_templates;
CREATE POLICY "admin manage templates" ON public.document_templates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_document_templates_updated_at ON public.document_templates;
CREATE TRIGGER trg_document_templates_updated_at BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_document_templates_category ON public.document_templates(category) WHERE deleted_at IS NULL;
