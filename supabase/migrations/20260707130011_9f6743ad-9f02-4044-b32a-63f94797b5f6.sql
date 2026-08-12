-- KYC status
DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kyc_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS kyc_approved_by uuid;

-- Audit log columns
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS old_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workers_kyc_status ON public.workers(kyc_status);
CREATE INDEX IF NOT EXISTS idx_advances_status ON public.advances(status);

-- Fan out helper: notify every staff user (admin/super_admin/hr)
CREATE OR REPLACE FUNCTION public.notify_staff(_title text, _body text, _type text, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, link)
  SELECT DISTINCT ur.user_id, _title, _body, _type, _link
  FROM public.user_roles ur
  WHERE ur.role::text IN ('super_admin','admin','hr');
END $$;

-- KYC submitted / approved
CREATE OR REPLACE FUNCTION public.trg_worker_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_staff(
      'KYC submitted',
      COALESCE(NEW.full_name,'Worker') || ' (' || COALESCE(NEW.kyc_id,'') || ') submitted for KYC.',
      'kyc_submitted',
      '/workers/' || NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.kyc_status IS DISTINCT FROM OLD.kyc_status AND NEW.kyc_status = 'approved' THEN
    PERFORM public.notify_staff(
      'KYC approved',
      COALESCE(NEW.full_name,'Worker') || ' (' || COALESCE(NEW.kyc_id,'') || ') KYC approved.',
      'kyc_approved',
      '/workers/' || NEW.id
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_worker_notify_ins ON public.workers;
DROP TRIGGER IF EXISTS trg_worker_notify_upd ON public.workers;
CREATE TRIGGER trg_worker_notify_ins AFTER INSERT ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.trg_worker_notify();
CREATE TRIGGER trg_worker_notify_upd AFTER UPDATE ON public.workers
  FOR EACH ROW EXECUTE FUNCTION public.trg_worker_notify();

-- Advance request / approval / rejection
CREATE OR REPLACE FUNCTION public.trg_advance_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_staff(
      'Advance request',
      'New advance ' || COALESCE(NEW.advance_code,'') || ' for INR ' || NEW.amount::text,
      'advance_requested',
      '/advances/' || NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_staff(
        'Advance approved',
        'Advance ' || COALESCE(NEW.advance_code,'') || ' approved (INR ' || NEW.amount::text || ')',
        'advance_approved', '/advances/' || NEW.id);
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.notify_staff(
        'Advance rejected',
        'Advance ' || COALESCE(NEW.advance_code,'') || ' rejected',
        'advance_rejected', '/advances/' || NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_advance_notify_ins ON public.advances;
DROP TRIGGER IF EXISTS trg_advance_notify_upd ON public.advances;
CREATE TRIGGER trg_advance_notify_ins AFTER INSERT ON public.advances
  FOR EACH ROW EXECUTE FUNCTION public.trg_advance_notify();
CREATE TRIGGER trg_advance_notify_upd AFTER UPDATE ON public.advances
  FOR EACH ROW EXECUTE FUNCTION public.trg_advance_notify();

-- Blacklist alert
CREATE OR REPLACE FUNCTION public.trg_blacklist_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wname text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.active THEN
    SELECT full_name INTO wname FROM public.workers WHERE id = NEW.worker_id;
    PERFORM public.notify_staff(
      'Blacklist alert',
      COALESCE(wname,'Worker') || ' has been blacklisted.',
      'blacklist_alert', '/blacklist'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_blacklist_notify_ins ON public.blacklist_entries;
CREATE TRIGGER trg_blacklist_notify_ins AFTER INSERT ON public.blacklist_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_blacklist_notify();

-- New user created (via profiles insert from handle_new_user)
CREATE OR REPLACE FUNCTION public.trg_profile_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_staff(
      'New user created',
      COALESCE(NEW.full_name, NEW.email, 'A user') || ' joined the workspace.',
      'user_created', '/admin/users'
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profile_notify_ins ON public.profiles;
CREATE TRIGGER trg_profile_notify_ins AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profile_notify();