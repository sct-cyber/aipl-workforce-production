
-- Advance type enum
DO $$ BEGIN
  CREATE TYPE public.advance_type AS ENUM ('salary','emergency','festival','tool','travel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS advance_type public.advance_type NOT NULL DEFAULT 'salary',
  ADD COLUMN IF NOT EXISTS recovery_month date,
  ADD COLUMN IF NOT EXISTS recovery_amount numeric;

ALTER TABLE public.advance_approvals
  ADD COLUMN IF NOT EXISTS approver_role text;

CREATE INDEX IF NOT EXISTS idx_advances_worker_status ON public.advances (worker_id, status);
CREATE INDEX IF NOT EXISTS idx_installments_advance ON public.advance_installments (advance_id, status);
