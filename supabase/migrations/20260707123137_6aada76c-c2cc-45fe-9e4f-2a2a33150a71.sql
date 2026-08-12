
-- Extend blacklist category enum
ALTER TYPE public.blacklist_category ADD VALUE IF NOT EXISTS 'violence';
ALTER TYPE public.blacklist_category ADD VALUE IF NOT EXISTS 'substance_abuse';
ALTER TYPE public.blacklist_category ADD VALUE IF NOT EXISTS 'safety_violation';

-- Snapshot fields for previous project / designation at blacklist time
ALTER TABLE public.blacklist_entries
  ADD COLUMN IF NOT EXISTS previous_project text,
  ADD COLUMN IF NOT EXISTS previous_designation text,
  ADD COLUMN IF NOT EXISTS override_by uuid,
  ADD COLUMN IF NOT EXISTS override_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_reason text;

-- Fast lookup for Aadhaar-based blacklist checks
CREATE INDEX IF NOT EXISTS idx_workers_aadhaar ON public.workers (aadhaar_number) WHERE aadhaar_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blacklist_worker_active ON public.blacklist_entries (worker_id, active);
