
ALTER TYPE public.app_role RENAME VALUE 'hr_manager' TO 'hr';
ALTER TYPE public.app_role RENAME VALUE 'hr_officer' TO 'labour_incharge';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounts';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
      AND role::text IN ('super_admin','admin','hr','labour_incharge','project_manager','accounts')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id
      AND role::text IN ('super_admin','admin')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count int;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  ON CONFLICT (id) DO NOTHING;
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'super_admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'viewer') ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "admins manage profiles" ON public.profiles;
CREATE POLICY "admins manage profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_projects TO authenticated;
GRANT ALL ON public.user_projects TO service_role;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own assignments" ON public.user_projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "admins manage assignments" ON public.user_projects FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_user_projects_user ON public.user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_project ON public.user_projects(project_id);
