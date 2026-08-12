import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, HandCoins, Ban, ScrollText, Search, Download, Eye, UserPlus, Trash2,
} from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { ROLE_LABELS, type AppRole, useRoles } from "@/hooks/use-role";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type TabKey = "users" | "workers" | "advances" | "blacklist";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const [tab, setTab] = useState<TabKey>("users");

  const kpis = useQuery({
    queryKey: ["admin-overview-kpis"],
    queryFn: async () => {
      const [w, a, b, u] = await Promise.all([
        supabase.from("workers").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("advances").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("blacklist_entries").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      return { workers: w.count ?? 0, advances: a.count ?? 0, blacklisted: b.count ?? 0, users: u.count ?? 0 };
    },
  });

  const cards: Array<{ key: TabKey; label: string; value: number; icon: any; tone: string; bg: string }> = [
    { key: "workers", label: "Total Workers", value: kpis.data?.workers ?? 0, icon: Users, tone: "text-info", bg: "bg-info/10" },
    { key: "advances", label: "Total Advances", value: kpis.data?.advances ?? 0, icon: HandCoins, tone: "text-warning-foreground", bg: "bg-warning/15" },
    { key: "blacklist", label: "Active Blacklist", value: kpis.data?.blacklisted ?? 0, icon: Ban, tone: "text-destructive", bg: "bg-destructive/10" },
    { key: "users", label: "App Users", value: kpis.data?.users ?? 0, icon: ScrollText, tone: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {cards.map((k) => {
          const active = tab === k.key;
          return (
            <button
              key={k.key}
              onClick={() => setTab(k.key)}
              className="text-left"
              aria-pressed={active}
            >
              <Card
                className={`relative overflow-hidden transition hover:shadow-elevation-2 ${
                  active ? "border-primary shadow-elevation-2 ring-1 ring-primary/40" : "hover:border-primary/40"
                }`}
              >
                <CardContent className="p-3 sm:p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{k.label}</div>
                      <div className="mt-1.5 font-display text-xl sm:text-2xl font-bold tabular-nums truncate">
                        {kpis.isLoading ? <Skeleton className="h-7 w-14" /> : k.value}
                      </div>
                    </div>
                    <div className={`grid size-8 sm:size-9 shrink-0 place-items-center rounded-md ${k.bg}`}>
                      <k.icon className={`size-4 ${k.tone}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mt-4">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-3"><UsersPanel /></TabsContent>
        <TabsContent value="workers" className="mt-3"><WorkersPanel /></TabsContent>
        <TabsContent value="advances" className="mt-3"><AdvancesPanel /></TabsContent>
        <TabsContent value="blacklist" className="mt-3"><BlacklistPanel /></TabsContent>
      </Tabs>
    </>
  );
}

/* ------------------------------- helpers ------------------------------- */

function toCsv<T extends Record<string, any>>(rows: T[], cols: Array<{ key: string; label: string; get?: (r: T) => any }>) {
  const header = cols.map(c => c.label).join(",");
  const body = rows.map(r => cols.map(c => JSON.stringify((c.get ? c.get(r) : r[c.key]) ?? "")).join(",")).join("\n");
  return `${header}\n${body}`;
}
function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function SearchBar({ value, onChange, placeholder, right }: { value: string; onChange: (v: string) => void; placeholder: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" />
      </div>
      {right}
    </div>
  );
}

/* ------------------------------ App Users ------------------------------ */

function UsersPanel() {
  const [q, setQ] = useState("");
  const usersQ = useQuery({
    queryKey: ["admin-users-inline"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, is_active, last_login_at, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        roleMap.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });
  const filtered = useMemo(() => {
    const rows = usersQ.data ?? [];
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((u: any) =>
      (u.full_name ?? "").toLowerCase().includes(s) ||
      (u.email ?? "").toLowerCase().includes(s));
  }, [usersQ.data, q]);

  return (
    <Card>
      <CardContent className="p-3">
        <SearchBar
          value={q} onChange={setQ}
          placeholder="Search by name or email…"
          right={
            <>
              <Button variant="outline" size="sm" onClick={() => download(
                `users-${Date.now()}.csv`,
                toCsv(filtered, [
                  { key: "full_name", label: "Name" },
                  { key: "email", label: "Email" },
                  { key: "roles", label: "Role", get: (r: any) => (r.roles ?? []).map((x: AppRole) => ROLE_LABELS[x]).join("/") },
                  { key: "is_active", label: "Status", get: (r: any) => r.is_active ? "Active" : "Inactive" },
                  { key: "last_login_at", label: "Last Login" },
                ]),
              )}>
                <Download className="size-4" /> Export
              </Button>
              <Button size="sm" asChild><Link to="/admin/users"><UserPlus className="size-4" /> Add User</Link></Button>
            </>
          }
        />
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQ.isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6" /></TableCell></TableRow>
            ))}
            {!usersQ.isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No users found.</TableCell></TableRow>
            )}
            {filtered.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  {(u.roles ?? []).map((r: AppRole) => (
                    <Badge key={r} variant="secondary" className="mr-1">{ROLE_LABELS[r]}</Badge>
                  ))}
                </TableCell>
                <TableCell>
                  {u.is_active
                    ? <Badge className="bg-success/15 text-success border-success/30">Active</Badge>
                    : <Badge variant="outline">Inactive</Badge>}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {u.last_login_at ? fmtDate(u.last_login_at) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm"><Link to="/admin/users">Edit</Link></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ------------------------------- Workers ------------------------------- */

function WorkersPanel() {
  const [q, setQ] = useState("");
  const qy = useQuery({
    queryKey: ["admin-workers-inline", q],
    queryFn: async () => {
      let query = supabase
        .from("workers")
        .select("id, worker_code, full_name, phone, aadhaar_number, status, projects(name), trades(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (q.trim()) query = query.or(`full_name.ilike.%${q}%,worker_code.ilike.%${q}%,phone.ilike.%${q}%,aadhaar_number.ilike.%${q}%`);
      const { data } = await query;
      return data ?? [];
    },
  });
  const rows = qy.data ?? [];
  return (
    <Card>
      <CardContent className="p-3">
        <SearchBar
          value={q} onChange={setQ}
          placeholder="Search worker name, code, mobile, Aadhaar…"
          right={
            <>
              <Button variant="outline" size="sm" onClick={() => download(
                `workers-${Date.now()}.csv`,
                toCsv(rows as any, [
                  { key: "worker_code", label: "Worker Code" },
                  { key: "full_name", label: "Full Name" },
                  { key: "phone", label: "Mobile" },
                  { key: "aadhaar_number", label: "Aadhaar" },
                  { key: "project", label: "Project", get: (r: any) => r.projects?.name },
                  { key: "trade", label: "Trade", get: (r: any) => r.trades?.name },
                  { key: "status", label: "Status" },
                ]),
              )}><Download className="size-4" /> Export</Button>
              <Button size="sm" asChild><Link to="/workers">Open list</Link></Button>
            </>
          }
        />
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead className="hidden md:table-cell">Mobile</TableHead>
              <TableHead className="hidden md:table-cell">Aadhaar</TableHead>
              <TableHead className="hidden lg:table-cell">Project</TableHead>
              <TableHead className="hidden lg:table-cell">Trade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qy.isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6" /></TableCell></TableRow>
            ))}
            {!qy.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No workers found.</TableCell></TableRow>
            )}
            {rows.map((w: any) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono text-xs">{w.worker_code}</TableCell>
                <TableCell className="font-medium">{w.full_name}</TableCell>
                <TableCell className="hidden md:table-cell">{w.phone ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-xs">{w.aadhaar_number ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{w.projects?.name ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{w.trades?.name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{w.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm"><Link to="/workers/$id" params={{ id: w.id }}><Eye className="size-4" /></Link></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ------------------------------ Advances ------------------------------- */

function AdvancesPanel() {
  const qc = useQueryClient();
  const { isAdmin } = useRoles();
  const [q, setQ] = useState("");
  const [delFor, setDelFor] = useState<any>(null);
  const qy = useQuery({
    queryKey: ["admin-advances-inline", q],
    queryFn: async () => {
      let query = supabase
        .from("advances")
        .select("id, advance_code, amount, status, request_date, worker:workers(full_name, worker_code), project:projects(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (q.trim()) query = query.or(`advance_code.ilike.%${q}%`);
      const { data } = await query;
      const rows = data ?? [];
      if (!q.trim()) return rows;
      const s = q.toLowerCase();
      return rows.filter((r: any) =>
        (r.advance_code ?? "").toLowerCase().includes(s) ||
        (r.worker?.full_name ?? "").toLowerCase().includes(s) ||
        (r.worker?.worker_code ?? "").toLowerCase().includes(s));
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("advances").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Advance deleted");
      setDelFor(null);
      qc.invalidateQueries({ queryKey: ["admin-advances-inline"] });
      qc.invalidateQueries({ queryKey: ["admin-overview-kpis"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const rows = qy.data ?? [];
  return (
    <Card>
      <CardContent className="p-3">
        <SearchBar
          value={q} onChange={setQ}
          placeholder="Search advance no, worker name…"
          right={
            <Button variant="outline" size="sm" onClick={() => download(
              `advances-${Date.now()}.csv`,
              toCsv(rows as any, [
                { key: "advance_code", label: "Advance No" },
                { key: "worker", label: "Worker", get: (r: any) => r.worker?.full_name },
                { key: "project", label: "Project", get: (r: any) => r.project?.name },
                { key: "amount", label: "Amount" },
                { key: "status", label: "Status" },
              ]),
            )}><Download className="size-4" /> Export</Button>
          }
        />
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>Advance No</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead className="hidden md:table-cell">Project</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qy.isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6" /></TableCell></TableRow>
            ))}
            {!qy.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No advances found.</TableCell></TableRow>
            )}
            {rows.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.advance_code}</TableCell>
                <TableCell className="font-medium">{a.worker?.full_name ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{a.project?.name ?? "—"}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(a.amount)}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{a.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button asChild variant="ghost" size="sm"><Link to="/advances/$id" params={{ id: a.id }}><Eye className="size-4" /></Link></Button>
                  {isAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => setDelFor(a)} className="text-destructive hover:text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!delFor} onOpenChange={(v) => !v && setDelFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Advance?</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <p>This action cannot be undone.</p>
            {delFor?.status === "approved" && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-warning-foreground">
                <strong>Warning:</strong> this advance is already <b>approved</b>.
              </div>
            )}
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="font-mono">{delFor?.advance_code}</div>
              <div className="text-xs text-muted-foreground">{inr(delFor?.amount ?? 0)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelFor(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => del.mutate(delFor.id)} disabled={del.isPending}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------ Blacklist ------------------------------ */

function BlacklistPanel() {
  const [q, setQ] = useState("");
  const qy = useQuery({
    queryKey: ["admin-blacklist-inline"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blacklist_entries")
        .select("id, reason, active, created_at, worker:workers(full_name, aadhaar_number, worker_code)")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });
  const rows = useMemo(() => {
    const all = qy.data ?? [];
    if (!q.trim()) return all;
    const s = q.toLowerCase();
    return all.filter((r: any) =>
      (r.worker?.full_name ?? "").toLowerCase().includes(s) ||
      (r.worker?.aadhaar_number ?? "").toLowerCase().includes(s));
  }, [qy.data, q]);

  return (
    <Card>
      <CardContent className="p-3">
        <SearchBar
          value={q} onChange={setQ}
          placeholder="Search worker name, Aadhaar…"
          right={
            <Button variant="outline" size="sm" onClick={() => download(
              `blacklist-${Date.now()}.csv`,
              toCsv(rows as any, [
                { key: "worker", label: "Worker", get: (r: any) => r.worker?.full_name },
                { key: "aadhaar", label: "Aadhaar", get: (r: any) => r.worker?.aadhaar_number },
                { key: "reason", label: "Reason" },
                { key: "created_at", label: "Blacklisted Date" },
                { key: "active", label: "Status", get: (r: any) => r.active ? "Active" : "Lifted" },
              ]),
            )}><Download className="size-4" /> Export</Button>
          }
        />
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead className="hidden md:table-cell">Aadhaar</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="hidden lg:table-cell">Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qy.isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6" /></TableCell></TableRow>
            ))}
            {!qy.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No active blacklist entries.</TableCell></TableRow>
            )}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.worker?.full_name ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-xs">{r.worker?.aadhaar_number ?? "—"}</TableCell>
                <TableCell className="max-w-md truncate">{r.reason}</TableCell>
                <TableCell className="hidden lg:table-cell">{fmtDate(r.created_at)}</TableCell>
                <TableCell><Badge variant="destructive">Active</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
