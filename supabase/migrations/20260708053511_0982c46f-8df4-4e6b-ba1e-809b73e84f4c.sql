
-- Projects: super_admin + admin full CRUD; staff (incl hr, viewer) read-only
DROP POLICY IF EXISTS "Admin delete projects" ON public.projects;
DROP POLICY IF EXISTS "Managers insert projects" ON public.projects;
DROP POLICY IF EXISTS "Managers update projects" ON public.projects;
DROP POLICY IF EXISTS "Staff read projects" ON public.projects;

CREATE POLICY "projects select staff" ON public.projects
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "projects insert admin" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "projects update admin" ON public.projects
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "projects delete admin" ON public.projects
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Trades
DROP POLICY IF EXISTS "Admin write trades" ON public.trades;
DROP POLICY IF EXISTS "Auth read trades" ON public.trades;

CREATE POLICY "trades select auth" ON public.trades
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "trades insert admin" ON public.trades
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "trades update admin" ON public.trades
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "trades delete admin" ON public.trades
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Designations
DROP POLICY IF EXISTS "Admin write designations" ON public.designations;
DROP POLICY IF EXISTS "Auth read designations" ON public.designations;

CREATE POLICY "designations select auth" ON public.designations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "designations insert admin" ON public.designations
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "designations update admin" ON public.designations
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "designations delete admin" ON public.designations
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Document templates
DROP POLICY IF EXISTS "admin manage templates" ON public.document_templates;
DROP POLICY IF EXISTS "staff read templates" ON public.document_templates;

CREATE POLICY "templates select staff" ON public.document_templates
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "templates insert admin" ON public.document_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "templates update admin" ON public.document_templates
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "templates delete admin" ON public.document_templates
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- User roles: only admin/super_admin manage; users read own
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;

CREATE POLICY "user_roles select self or admin" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "user_roles insert admin" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_roles update admin" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_roles delete admin" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Profiles: keep self-manage; admins can update any (already exists). Ensure admins can also insert/delete if needed.
DROP POLICY IF EXISTS "admins manage profiles" ON public.profiles;
CREATE POLICY "profiles update admin" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "profiles delete admin" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
