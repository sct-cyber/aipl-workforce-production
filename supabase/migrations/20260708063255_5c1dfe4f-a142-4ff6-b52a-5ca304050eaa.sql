
CREATE SEQUENCE IF NOT EXISTS public.workers_worker_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_worker_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.worker_code IS NULL OR NEW.worker_code = '' THEN
    NEW.worker_code := 'AIPL-WRK-' || lpad(nextval('public.workers_worker_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_worker_code ON public.workers;
CREATE TRIGGER trg_assign_worker_code
BEFORE INSERT ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.assign_worker_code();

-- Ensure existing kyc_id trigger also fires (idempotent)
DROP TRIGGER IF EXISTS trg_assign_worker_kyc_id ON public.workers;
CREATE TRIGGER trg_assign_worker_kyc_id
BEFORE INSERT ON public.workers
FOR EACH ROW EXECUTE FUNCTION public.assign_worker_kyc_id();

-- Seed sequence past any existing worker_code numbers
SELECT setval(
  'public.workers_worker_seq',
  GREATEST(
    (SELECT COALESCE(MAX(NULLIF(regexp_replace(worker_code, '^AIPL-WRK-', ''), '')::int), 0) FROM public.workers WHERE worker_code ~ '^AIPL-WRK-\d+$'),
    1
  )
);

ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS uan_number text;
