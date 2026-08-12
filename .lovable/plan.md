# AIPL Worker KYC & Advance Management System — Build Plan

Production-grade enterprise SaaS with 5 modules: Dashboard, Worker KYC Registry, Advance (Kharchi), Blacklist, Admin. Built on React + TypeScript + Tailwind + ShadCN + Lovable Cloud (Supabase).

## Scope

**In scope (only):** Dashboard, Worker KYC Registry, Advance (Kharchi), Blacklist, Admin
**Explicitly out:** Attendance, Payroll, PF, ESIC, Wage Rate, Rejoining, Salary Processing

## Architecture

### Shell & Layout
- `__root.tsx`: Providers (Query, Theme, Auth, Toaster) + `<Outlet />`
- `_authenticated/route.tsx` (managed gate) wraps all app routes
- `AppShell`: Sidebar + Header + main content
- **Sidebar behavior:**
  - Desktop: collapsed 80px by default, hover-expand to 280px, auto-collapse on mouse-leave
  - Tablet: manual toggle
  - Mobile: Sheet/Drawer
- **Header:** Global search (⌘K command palette), notification bell (popover), theme toggle (light/dark), user profile menu

### Design System (`src/styles.css`)
Semantic tokens via `@theme inline` + oklch values:
- Light: bg `#F8FAFC`, card `#FFFFFF`, primary `#B91C1C`
- Dark: bg `#0F172A`, card `#1E293B`, primary `#DC2626`
- Custom tokens: `--sidebar`, `--sidebar-hover`, `--success`, `--warning`, `--info`, `--elevation-1/2/3`, `--gradient-primary`
- Enterprise-feel: tight radii (6px), Inter body + IBM Plex Sans headings, subtle shadows, dense tables

### Routes
```
/auth                          public sign-in/sign-up
/                              → redirect to /dashboard (or /auth)
/_authenticated/
  dashboard                    KPIs, charts, recent activity
  workers                      Worker KYC list (search/filter/table)
  workers/new                  Multi-step KYC intake
  workers/$id                  Worker profile (tabs: Personal, Documents, Advances, History)
  workers/$id/edit             Edit KYC
  advances                     Advance (Kharchi) list
  advances/new                 Create advance request
  advances/$id                 Advance detail + approval workflow
  blacklist                    Blacklist registry
  blacklist/new                Add to blacklist
  admin                        Admin overview
  admin/users                  App users
  admin/roles                  Role management
  admin/audit                  Audit log
  admin/settings               System settings
```

## Data Model (Supabase)

### Tables
- `profiles` (id → auth.users, full_name, email, avatar_url, phone, created_at)
- `user_roles` (id, user_id, role: admin|hr_manager|hr_officer|viewer) — separate table, `has_role()` security definer
- `workers` — KYC master
  - id, worker_code (unique), full_name, father_name, dob, gender, phone, alt_phone, email
  - aadhaar_number (masked), pan_number, address, city, state, pincode
  - department, designation, date_of_joining, employment_type, status (active/inactive/blacklisted)
  - bank_name, account_number, ifsc, upi_id
  - emergency_contact_name, emergency_contact_phone, emergency_relation
  - photo_url, created_by, created_at, updated_at
- `worker_documents` (id, worker_id, doc_type: aadhaar|pan|bank|photo|other, file_url, uploaded_at, uploaded_by)
- `advances` — Kharchi
  - id, advance_code (auto), worker_id, amount, reason, request_date
  - status (pending/approved/rejected/disbursed/repaid), approved_by, approved_at
  - disbursed_at, repayment_terms, notes, created_by
- `advance_installments` (id, advance_id, amount, due_date, paid_at, status)
- `blacklist_entries` (id, worker_id, reason, category (fraud/absconding/misconduct/theft/other), evidence_url, added_by, added_at, active)
- `audit_log` (id, actor_id, action, entity_type, entity_id, changes jsonb, ip, created_at)
- `notifications` (id, user_id, title, body, type, read, link, created_at)

### Security
- RLS on every table
- `public.has_role(uuid, app_role)` security definer function
- Policies:
  - workers/advances/blacklist: viewers can SELECT; hr_officer+ can INSERT/UPDATE; admin can DELETE
  - user_roles: only admin can modify; users can read own role
  - audit_log: append-only, admin-only SELECT
- Grants: `authenticated` gets appropriate CRUD; `service_role` gets ALL
- Storage bucket `worker-documents` (private) with RLS-scoped policies

## Modules

### 1. Dashboard
- KPI cards: Total Workers, Active Workers, Pending Advances, Total Outstanding, Blacklisted Count, New This Month
- Charts (Recharts): Advances trend (line), Workers by department (bar), Status distribution (donut)
- Recent activity feed, pending approvals queue, quick actions

### 2. Worker KYC Registry
- Dense data table: search, filter (dept, status, joining date), column sort, pagination, bulk export CSV
- Row actions: view, edit, blacklist
- Multi-step KYC intake wizard: Personal → Contact → Employment → Bank → Documents (upload to Storage) → Review
- Worker profile page with tabs
- Zod validation for all inputs; Aadhaar/PAN format checks

### 3. Advance (Kharchi)
- Table: worker, amount, date, status, approver
- New advance form with worker autocomplete
- Detail page: approval workflow (approve/reject with reason), installment schedule, repayment tracking, status timeline

### 4. Blacklist
- Registry table with reason category filters
- Add form (select worker → reason → category → evidence upload)
- Detail modal; deactivate (unblacklist) with reason
- Adding to blacklist auto-updates worker.status

### 5. Admin
- Users list with role assignment
- Roles reference page (permissions matrix)
- Audit log viewer with filters (actor, entity, date range)
- Settings (org name, logo, defaults)

## Technical Details

- Auth: email/password + Google (via Lovable broker)
- Server functions (`createServerFn` + `requireSupabaseAuth`) for all writes; TanStack Query loaders for reads
- Forms: react-hook-form + Zod
- Tables: TanStack Table for sorting/filtering/pagination
- Charts: Recharts
- Notifications: toast (sonner) + persistent bell dropdown
- Command palette: ⌘K global search across workers/advances
- Icons: lucide-react
- Fonts: Inter + IBM Plex Sans via `<link>` in `__root.tsx`

## Delivery Order

1. Enable Lovable Cloud + migrations (all tables, RLS, roles, storage)
2. Design system (`styles.css`) + fonts + shell layout (sidebar + header)
3. Auth (sign-in/sign-up + `_authenticated` gate)
4. Dashboard
5. Worker KYC (list + wizard + profile)
6. Advance (Kharchi) (list + create + approval)
7. Blacklist
8. Admin (users/roles/audit/settings)
9. Polish: command palette, notifications, empty/loading/error states, mobile responsiveness pass

## Questions before I start

1. **Auth methods:** email/password + Google sign-in (my default), or email/password only?
2. **First admin user:** Should the first user who signs up be auto-promoted to admin, or do you want me to seed a specific admin email?
3. **Advance approval workflow:** single-step (any HR manager approves) or two-step (HR officer requests → HR manager approves)?
4. **Currency & locale:** INR with ₹ symbol and Indian number formatting (1,00,000)?

Once you confirm (or say "use defaults"), I'll start building.
