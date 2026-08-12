
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'hr_manager', 'hr_officer', 'viewer');
create type public.worker_status as enum ('active', 'inactive', 'blacklisted');
create type public.gender as enum ('male', 'female', 'other');
create type public.employment_type as enum ('permanent', 'contract', 'daily_wage', 'temporary');
create type public.advance_status as enum ('pending', 'approved', 'rejected', 'disbursed', 'repaid');
create type public.blacklist_category as enum ('fraud', 'absconding', 'misconduct', 'theft', 'other');
create type public.doc_type as enum ('aadhaar', 'pan', 'bank', 'photo', 'other');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','hr_manager','hr_officer')) $$;

create policy "users read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ Auto profile + first-user admin ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  user_count int;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;

  select count(*) into user_count from auth.users;
  if user_count <= 1 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'viewer') on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ updated_at helper ============
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

-- ============ WORKERS ============
create table public.workers (
  id uuid primary key default gen_random_uuid(),
  worker_code text not null unique,
  full_name text not null,
  father_name text,
  dob date,
  gender gender,
  phone text,
  alt_phone text,
  email text,
  aadhaar_number text,
  pan_number text,
  address text,
  city text,
  state text,
  pincode text,
  department text,
  designation text,
  date_of_joining date,
  employment_type employment_type default 'permanent',
  status worker_status not null default 'active',
  bank_name text,
  account_number text,
  ifsc text,
  upi_id text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_relation text,
  photo_url text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workers_status_idx on public.workers(status);
create index workers_dept_idx on public.workers(department);
create index workers_full_name_idx on public.workers(full_name);

grant select, insert, update, delete on public.workers to authenticated;
grant all on public.workers to service_role;
alter table public.workers enable row level security;
create policy "staff read workers" on public.workers for select to authenticated using (public.is_staff(auth.uid()) or public.has_role(auth.uid(),'viewer'));
create policy "staff insert workers" on public.workers for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "staff update workers" on public.workers for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "admins delete workers" on public.workers for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger workers_updated before update on public.workers for each row execute function public.set_updated_at();

-- ============ WORKER DOCUMENTS ============
create table public.worker_documents (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  doc_type doc_type not null,
  file_url text not null,
  file_name text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);
create index worker_docs_worker_idx on public.worker_documents(worker_id);
grant select, insert, update, delete on public.worker_documents to authenticated;
grant all on public.worker_documents to service_role;
alter table public.worker_documents enable row level security;
create policy "staff read docs" on public.worker_documents for select to authenticated using (public.is_staff(auth.uid()) or public.has_role(auth.uid(),'viewer'));
create policy "staff write docs" on public.worker_documents for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "staff update docs" on public.worker_documents for update to authenticated using (public.is_staff(auth.uid()));
create policy "staff delete docs" on public.worker_documents for delete to authenticated using (public.is_staff(auth.uid()));

-- ============ ADVANCES (Kharchi) ============
create sequence if not exists public.advance_code_seq;
create table public.advances (
  id uuid primary key default gen_random_uuid(),
  advance_code text not null unique default ('ADV-' || lpad(nextval('public.advance_code_seq')::text, 6, '0')),
  worker_id uuid not null references public.workers(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  reason text,
  request_date date not null default current_date,
  status advance_status not null default 'pending',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  disbursed_at timestamptz,
  repayment_terms text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index advances_worker_idx on public.advances(worker_id);
create index advances_status_idx on public.advances(status);
grant select, insert, update, delete on public.advances to authenticated;
grant all on public.advances to service_role;
alter table public.advances enable row level security;
create policy "staff read advances" on public.advances for select to authenticated using (public.is_staff(auth.uid()) or public.has_role(auth.uid(),'viewer'));
create policy "staff insert advances" on public.advances for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "staff update advances" on public.advances for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "admin delete advances" on public.advances for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create trigger advances_updated before update on public.advances for each row execute function public.set_updated_at();

-- ============ ADVANCE INSTALLMENTS ============
create table public.advance_installments (
  id uuid primary key default gen_random_uuid(),
  advance_id uuid not null references public.advances(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  paid_at timestamptz,
  paid_amount numeric(12,2),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index installments_advance_idx on public.advance_installments(advance_id);
grant select, insert, update, delete on public.advance_installments to authenticated;
grant all on public.advance_installments to service_role;
alter table public.advance_installments enable row level security;
create policy "staff read installments" on public.advance_installments for select to authenticated using (public.is_staff(auth.uid()) or public.has_role(auth.uid(),'viewer'));
create policy "staff write installments" on public.advance_installments for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- ============ BLACKLIST ============
create table public.blacklist_entries (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  reason text not null,
  category blacklist_category not null default 'other',
  evidence_url text,
  active boolean not null default true,
  added_by uuid references auth.users(id),
  added_at timestamptz not null default now(),
  deactivated_by uuid references auth.users(id),
  deactivated_at timestamptz,
  deactivation_reason text
);
create index blacklist_worker_idx on public.blacklist_entries(worker_id);
create index blacklist_active_idx on public.blacklist_entries(active);
grant select, insert, update, delete on public.blacklist_entries to authenticated;
grant all on public.blacklist_entries to service_role;
alter table public.blacklist_entries enable row level security;
create policy "staff read blacklist" on public.blacklist_entries for select to authenticated using (public.is_staff(auth.uid()) or public.has_role(auth.uid(),'viewer'));
create policy "staff insert blacklist" on public.blacklist_entries for insert to authenticated with check (public.is_staff(auth.uid()));
create policy "staff update blacklist" on public.blacklist_entries for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Auto-update worker status when blacklisted
create or replace function public.sync_worker_blacklist_status()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and NEW.active) then
    update public.workers set status = 'blacklisted' where id = NEW.worker_id;
  elsif (TG_OP = 'UPDATE') then
    if NEW.active and not OLD.active then
      update public.workers set status = 'blacklisted' where id = NEW.worker_id;
    elsif OLD.active and not NEW.active then
      -- if no other active entries, restore to active
      if not exists (select 1 from public.blacklist_entries where worker_id = NEW.worker_id and active and id <> NEW.id) then
        update public.workers set status = 'active' where id = NEW.worker_id;
      end if;
    end if;
  end if;
  return NEW;
end $$;
create trigger blacklist_sync after insert or update on public.blacklist_entries
for each row execute function public.sync_worker_blacklist_status();

-- ============ AUDIT LOG ============
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.audit_log(created_at desc);
grant select, insert on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin read audit" on public.audit_log for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "authenticated insert audit" on public.audit_log for insert to authenticated with check (auth.uid() = actor_id);

-- ============ NOTIFICATIONS ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text default 'info',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notif_user_idx on public.notifications(user_id, read, created_at desc);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "users read own notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "users update own notifications" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "staff insert notifications" on public.notifications for insert to authenticated with check (public.is_staff(auth.uid()) or auth.uid() = user_id);
