
-- KYC ID sequence + auto-assign
CREATE SEQUENCE IF NOT EXISTS public.workers_kyc_seq START 1;

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS kyc_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS nominee_name text,
  ADD COLUMN IF NOT EXISTS nominee_relation text,
  ADD COLUMN IF NOT EXISTS nominee_phone text,
  ADD COLUMN IF NOT EXISTS nominee_dob date,
  ADD COLUMN IF NOT EXISTS nominee_aadhaar text;

CREATE OR REPLACE FUNCTION public.assign_worker_kyc_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kyc_id IS NULL OR NEW.kyc_id = '' THEN
    NEW.kyc_id := 'AIPL-KYC-' || lpad(nextval('public.workers_kyc_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_worker_kyc_id ON public.workers;
CREATE TRIGGER trg_assign_worker_kyc_id
BEFORE INSERT ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.assign_worker_kyc_id();

-- Backfill existing rows
UPDATE public.workers SET kyc_id = 'AIPL-KYC-' || lpad(nextval('public.workers_kyc_seq')::text, 6, '0') WHERE kyc_id IS NULL;
