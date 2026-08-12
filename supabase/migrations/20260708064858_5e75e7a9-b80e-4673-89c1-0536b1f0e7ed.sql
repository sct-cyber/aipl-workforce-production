
-- audit_log: super_admin should also read
DROP POLICY IF EXISTS "admin read audit" ON public.audit_log;
CREATE POLICY "admin read audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- workers DELETE include super_admin
DROP POLICY IF EXISTS "admins delete workers" ON public.workers;
CREATE POLICY "admins delete workers" ON public.workers
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- generated_documents DELETE include super_admin + add UPDATE
DROP POLICY IF EXISTS "Admin delete generated docs" ON public.generated_documents;
CREATE POLICY "Admin delete generated docs" ON public.generated_documents
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Staff update generated docs" ON public.generated_documents
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- blacklist_entries DELETE for admins
CREATE POLICY "admin delete blacklist" ON public.blacklist_entries
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- worker_documents UPDATE add with_check
DROP POLICY IF EXISTS "staff update docs" ON public.worker_documents;
CREATE POLICY "staff update docs" ON public.worker_documents
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
