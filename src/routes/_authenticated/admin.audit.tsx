import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldAlert, Search, Eye, Monitor, Smartphone, Tablet, Globe } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditLog,
});

const ACTION_TONE: Record<string, string> = {
  insert: "bg-info/10 text-info border-info/30",
  update: "bg-warning/10 text-warning-foreground border-warning/30",
  delete: "bg-destructive/10 text-destructive border-destructive/30",
  approve: "bg-success/10 text-success border-success/30",
  reject: "bg-destructive/10 text-destructive border-destructive/30",
  override: "bg-primary/10 text-primary border-primary/30",
  login: "bg-muted text-muted-foreground",
};

function deviceIcon(ua?: string | null) {
  if (!ua) return Globe;
  const s = ua.toLowerCase();
  if (/mobile|iphone|android/.test(s) && !/ipad|tablet/.test(s)) return Smartphone;
  if (/ipad|tablet/.test(s)) return Tablet;
  return Monitor;
}

function AuditLog() {
  const { isAdmin, isStaff } = useRoles();
  const [q, setQ] = useState("");
  const [module, setModule] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [row, setRow] = useState<any>(null);

  const data = useQuery({
    queryKey: ["audit-full"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*, actor:profiles!audit_log_actor_id_fkey(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        // fallback without join
        const { data: d2 } = await supabase.from("audit_log").select("*")
          .order("created_at", { ascending: false }).limit(500);
        return d2 ?? [];
      }
      return data ?? [];
    },
  });

  const modules = useMemo(() => {
    const s = new Set<string>();
    (data.data ?? []).forEach((r: any) => r.module && s.add(r.module));
    return [...s].sort();
  }, [data.data]);

  const actions = useMemo(() => {
    const s = new Set<string>();
    (data.data ?? []).forEach((r: any) => r.action && s.add(r.action));
    return [...s].sort();
  }, [data.data]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data.data ?? []).filter((r: any) => {
      if (module !== "all" && r.module !== module) return false;
      if (action !== "all" && r.action !== action) return false;
      if (!s) return true;
      return (
        (r.entity_type ?? "").toLowerCase().includes(s) ||
        (r.entity_id ?? "").toLowerCase().includes(s) ||
        (r.actor?.email ?? "").toLowerCase().includes(s) ||
        (r.actor?.full_name ?? "").toLowerCase().includes(s) ||
        (r.ip_address ?? "").toLowerCase().includes(s)
      );
    });
  }, [data.data, q, module, action]);

  if (!isStaff) {
    return <Alert><ShieldAlert className="size-4" /><AlertDescription>Staff access required.</AlertDescription></Alert>;
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="p-3 border-b flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input placeholder="Search actor, entity, IP…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <Select value={module} onValueChange={setModule}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="ml-auto">{filtered.length} entries</Badge>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                      No audit entries.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r: any) => {
                  const Dev = deviceIcon(r.user_agent);
                  const tone = ACTION_TONE[r.action?.toLowerCase()] ?? "bg-muted text-muted-foreground";
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(r.created_at)}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.actor?.full_name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{r.actor?.email ?? r.actor_id ?? "system"}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.actor_role ? <Badge variant="outline" className="capitalize">{r.actor_role}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.module ? <Badge variant="secondary" className="capitalize">{r.module}</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`border ${tone} capitalize`} variant="outline">{r.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{r.entity_type}</div>
                        <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]">{r.entity_id ?? "—"}</div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{r.ip_address ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={r.user_agent ?? ""}>
                          <Dev className="size-3.5" />
                          <span className="hidden lg:inline truncate max-w-[120px]">{(r.user_agent ?? "—").split(" ")[0]}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setRow(r)}>
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!row} onOpenChange={(o) => !o && setRow(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Audit entry · <span className="font-mono text-xs">{row?.id}</span>
            </DialogTitle>
          </DialogHeader>
          {row && (
            <div className="grid gap-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <Meta k="When" v={fmtDateTime(row.created_at)} />
                <Meta k="Action" v={row.action} />
                <Meta k="Module" v={row.module ?? "—"} />
                <Meta k="Role" v={row.actor_role ?? "—"} />
                <Meta k="Entity" v={`${row.entity_type} · ${row.entity_id ?? "—"}`} />
                <Meta k="Actor" v={row.actor?.email ?? row.actor_id ?? "system"} />
                <Meta k="IP address" v={row.ip_address ?? "—"} />
                <Meta k="Device" v={row.user_agent ?? "—"} />
              </div>
              {(row.old_values || row.new_values || row.changes) && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <JsonBlock label="Old values" data={row.old_values ?? row.changes?.old} />
                  <JsonBlock label="New values" data={row.new_values ?? row.changes?.new ?? row.changes} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-xs font-medium break-all">{v}</div>
    </div>
  );
}

function JsonBlock({ label, data }: { label: string; data: any }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[11px]">
        {data ? JSON.stringify(data, null, 2) : "—"}
      </pre>
    </div>
  );
}
