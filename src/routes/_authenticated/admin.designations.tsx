import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, ShieldAlert, Layers } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/designations")({
  component: DesignationsMaster,
});

const LEVELS = [
  { v: 1, label: "L1 · Helper" },
  { v: 2, label: "L2 · Semi-Skilled" },
  { v: 3, label: "L3 · Skilled" },
  { v: 4, label: "L4 · Highly Skilled" },
  { v: 5, label: "L5 · Supervisor" },
];

const schema = z.object({
  code: z.string().trim().min(1, "Required").max(40),
  name: z.string().trim().min(1, "Required").max(120),
  trade_id: z.string().uuid().nullable().optional(),
  level: z.number().int().min(1).max(5).nullable().optional(),
  active: z.boolean(),
});
type FormT = z.infer<typeof schema>;

function DesignationsMaster() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isStaff } = useRoles();
  const [edit, setEdit] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<any>(null);

  const tradesQ = useQuery({
    queryKey: ["trades-active"],
    queryFn: async () => (await supabase.from("trades").select("id, name").eq("active", true).is("deleted_at", null).order("name")).data ?? [],
  });
  const list = useQuery({
    queryKey: ["designations-master"],
    queryFn: async () => (await supabase.from("designations").select("*, trade:trades(id, name)").is("deleted_at", null).order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: FormT & { id?: string }) => {
      const payload: any = { code: v.code, name: v.name, trade_id: v.trade_id || null, level: v.level ?? null, active: v.active };
      if (v.id) {
        const { error } = await supabase.from("designations").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("designations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setOpen(false); setEdit(null); qc.invalidateQueries({ queryKey: ["designations-master"] }); qc.invalidateQueries({ queryKey: ["designations-active"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("designations").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Designation archived"); setDel(null); qc.invalidateQueries({ queryKey: ["designations-master"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  if (!isStaff) return <Alert><ShieldAlert className="size-4" /><AlertDescription>Staff access required.</AlertDescription></Alert>;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <h2 className="font-semibold">Designation Master</h2>
              <Badge variant="secondary">{list.data?.length ?? 0}</Badge>
            </div>
            {isAdmin && (
              <Dialog open={open && !edit} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
                <DialogTrigger asChild><Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="size-4" /> New designation</Button></DialogTrigger>
                <DesignationDialog defaults={null} trades={tradesQ.data ?? []} onSubmit={(v) => save.mutate(v)} pending={save.isPending} />
              </Dialog>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Skill level</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-24 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data?.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No designations yet.</TableCell></TableRow>}
              {list.data?.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">{d.code}</TableCell>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.trade?.name ?? "—"}</TableCell>
                  <TableCell>{d.level ? LEVELS.find((l) => l.v === d.level)?.label : "—"}</TableCell>
                  <TableCell><Badge variant={d.active ? "default" : "secondary"}>{d.active ? "Active" : "Inactive"}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Dialog open={edit?.id === d.id} onOpenChange={(o) => setEdit(o ? d : null)}>
                        <DialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => setEdit(d)}><Pencil className="size-4" /></Button></DialogTrigger>
                        <DesignationDialog defaults={d} trades={tradesQ.data ?? []} onSubmit={(v) => save.mutate({ ...v, id: d.id })} pending={save.isPending} />
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => setDel(d)}><Trash2 className="size-4 text-destructive" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Archive designation</DialogTitle></DialogHeader>
          <p className="text-sm">Archive <b>{del?.name}</b>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => remove.mutate(del.id)} disabled={remove.isPending}>{remove.isPending && <Loader2 className="size-4 animate-spin" />} Archive</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DesignationDialog({ defaults, trades, onSubmit, pending }: { defaults: any; trades: any[]; onSubmit: (v: FormT) => void; pending: boolean }) {
  const [v, setV] = useState<FormT>({
    code: defaults?.code ?? "",
    name: defaults?.name ?? "",
    trade_id: defaults?.trade_id ?? null,
    level: defaults?.level ?? null,
    active: defaults?.active ?? true,
  });
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(v);
    if (!r.success) { setErr(r.error.issues[0].message); return; }
    setErr(null); onSubmit(r.data);
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{defaults ? "Edit designation" : "New designation"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Code *"><Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></F>
          <F label="Designation *"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></F>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Trade mapping">
            <Select value={v.trade_id ?? ""} onValueChange={(x) => setV({ ...v, trade_id: x })}>
              <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
              <SelectContent>{trades.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="Skill level">
            <Select value={v.level ? String(v.level) : ""} onValueChange={(x) => setV({ ...v, level: Number(x) })}>
              <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
              <SelectContent>{LEVELS.map((l) => <SelectItem key={l.v} value={String(l.v)}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </F>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div><div className="text-sm font-medium">Active</div><div className="text-xs text-muted-foreground">Inactive designations are hidden from KYC forms.</div></div>
          <Switch checked={v.active} onCheckedChange={(x) => setV({ ...v, active: x })} />
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
        <DialogFooter><Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium">{label}</Label>{children}</div>;
}
