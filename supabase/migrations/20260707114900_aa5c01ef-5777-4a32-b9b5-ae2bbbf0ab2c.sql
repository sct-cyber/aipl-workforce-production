
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  client_name text,
  location text,
  state text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  budget numeric(14,2),
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read projects" ON public.projects FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Managers insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));
CREATE POLICY "Managers update projects" ON public.projects FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager'));
CREATE POLICY "Admin delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_manager ON public.projects(manager_id);
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read trades" ON public.trades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write trades" ON public.trades FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_trades_updated_at BEFORE UPDATE ON public.trades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  level int,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designations TO authenticated;
GRANT ALL ON public.designations TO service_role;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read designations" ON public.designations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write designations" ON public.designations FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_designations_trade ON public.designations(trade_id);
CREATE TRIGGER trg_designations_updated_at BEFORE UPDATE ON public.designations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trade_id uuid REFERENCES public.trades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS designation_id uuid REFERENCES public.designations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_workers_project ON public.workers(project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workers_trade ON public.workers(trade_id);
CREATE INDEX IF NOT EXISTS idx_workers_designation ON public.workers(designation_id);
CREATE INDEX IF NOT EXISTS idx_workers_status ON public.workers(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workers_phone ON public.workers(phone);
CREATE INDEX IF NOT EXISTS idx_workers_aadhaar ON public.workers(aadhaar_number);
CREATE INDEX IF NOT EXISTS idx_workers_name_trgm ON public.workers USING gin (full_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.worker_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  step int NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_drafts TO authenticated;
GRANT ALL ON public.worker_drafts TO service_role;
ALTER TABLE public.worker_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own drafts" ON public.worker_drafts FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_worker_drafts_owner ON public.worker_drafts(owner_id);
CREATE TRIGGER trg_worker_drafts_updated_at BEFORE UPDATE ON public.worker_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.worker_documents
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_worker_documents_worker ON public.worker_documents(worker_id) WHERE deleted_at IS NULL;

ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_advances_worker ON public.advances(worker_id);
CREATE INDEX IF NOT EXISTS idx_advances_project ON public.advances(project_id);
CREATE INDEX IF NOT EXISTS idx_advances_status ON public.advances(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_advances_request_date ON public.advances(request_date DESC);

CREATE TABLE IF NOT EXISTS public.advance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.advances(id) ON DELETE CASCADE,
  approver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  step int NOT NULL DEFAULT 1,
  decision text NOT NULL CHECK (decision IN ('approved','rejected','forwarded')),
  comments text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.advance_approvals TO authenticated;
GRANT ALL ON public.advance_approvals TO service_role;
ALTER TABLE public.advance_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read approvals" ON public.advance_approvals FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Managers add approvals" ON public.advance_approvals FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr_manager') OR public.has_role(auth.uid(),'hr_officer')) AND approver_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_advance_approvals_advance ON public.advance_approvals(advance_id);
CREATE INDEX IF NOT EXISTS idx_advance_approvals_approver ON public.advance_approvals(approver_id);

ALTER TABLE public.blacklist_entries ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_blacklist_worker ON public.blacklist_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_active ON public.blacklist_entries(active) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  document_type text NOT NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  metadata jsonb,
  generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_documents TO authenticated;
GRANT ALL ON public.generated_documents TO service_role;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read generated docs" ON public.generated_documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff create generated docs" ON public.generated_documents FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete generated docs" ON public.generated_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_gendocs_entity ON public.generated_documents(entity_type, entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gendocs_type ON public.generated_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_gendocs_created ON public.generated_documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read, created_at DESC);
