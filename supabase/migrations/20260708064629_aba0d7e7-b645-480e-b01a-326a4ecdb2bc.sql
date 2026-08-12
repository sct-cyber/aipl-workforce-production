
-- Fix advance_approvals INSERT to include all approver roles + super_admin
DROP POLICY IF EXISTS "Managers add approvals" ON public.advance_approvals;
CREATE POLICY "Approvers insert approvals" ON public.advance_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    approver_id = auth.uid()
    AND (
      public.is_admin(auth.uid())
      OR has_role(auth.uid(), 'hr'::app_role)
      OR has_role(auth.uid(), 'labour_incharge'::app_role)
      OR has_role(auth.uid(), 'project_manager'::app_role)
      OR has_role(auth.uid(), 'accounts'::app_role)
    )
  );

CREATE POLICY "Admins update approvals" ON public.advance_approvals
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins delete approvals" ON public.advance_approvals
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Ensure advances DELETE covers super_admin
DROP POLICY IF EXISTS "admin delete advances" ON public.advances;
CREATE POLICY "admin delete advances" ON public.advances
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
