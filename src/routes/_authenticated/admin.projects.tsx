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
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, ShieldAlert, Building2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/projects")({
  component: ProjectsMaster,
});

const schema = z.object({
  code: z.string().trim().min(1, "Required").max(40),
  name: z.string().trim().min(1, "Required").max(160),
  client_name: z.string().trim().max(160).optional().or(z.literal("")),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  end_date: z.string().optional().or(z.literal("")),
  status: z.enum(["planning", "active", "on_hold", "completed", "cancelled"]),
});
type FormT = z.infer<typeof schema>;

const STATUSES: FormT["status"][] = ["planning", "active", "on_hold", "completed", "cancelled"];

function ProjectsMaster() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isStaff } = useRoles();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const [del, setDel] = useState<any>(null);

  const list = useQuery({
    queryKey: ["projects-master"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects")
        .select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (v: FormT & { id?: string }) => {
      const payload: any = {
        code: v.code, name: v.name,
        client_name: v.client_name || null,
        location: v.location || null,
        start_date: v.start_date || null,
        end_date: v.end_date || null,
        status: v.status,
      };
      if (v.id) {
        payload.updated_by = user?.id;
        const { error } = await supabase.from("projects").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("projects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved"); setOpen(false); setEdit(null);
      qc.invalidateQueries({ queryKey: ["projects-master"] });
      qc.invalidateQueries({ queryKey: ["projects-all"] });
      qc.invalidateQueries({ queryKey: ["projects-active"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects")
        .update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project archived"); setDel(null);
      qc.invalidateQueries({ queryKey: ["projects-master"] });
      qc.invalidateQueries({ queryKey: ["projects-all"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  if (!isStaff) return <Alert><ShieldAlert className="size-4" /><AlertDescription>Staff access required.</AlertDescription></Alert>;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" />
              <h2 className="font-semibold">Project Master</h2>
              <Badge variant="secondary">{list.data?.length ?? 0}</Badge>
            </div>
            {isAdmin && (
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setEdit(null)}><Plus className="size-4" /> New project</Button>
                </DialogTrigger>
                <ProjectDialog defaults={edit} onSubmit={(v) => save.mutate({ ...v, id: edit?.id })} pending={save.isPending} />
              </Dialog>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-24 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading && <TableRow><TableCell colSpan={8} className="py-8 text-center"><Loader2 className="size-4 animate-spin inline" /></TableCell></TableRow>}
              {list.data?.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No projects yet.</TableCell></TableRow>}
              {list.data?.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.client_name ?? "—"}</TableCell>
                  <TableCell>{p.location ?? "—"}</TableCell>
                  <TableCell>{fmtDate(p.start_date)}</TableCell>
                  <TableCell>{fmtDate(p.end_date)}</TableCell>
                  <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">{p.status.replace("_", " ")}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Dialog open={edit?.id === p.id} onOpenChange={(o) => { if (o) { setEdit(p); setOpen(true); } else { setEdit(null); setOpen(false); } }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => { setEdit(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                        </DialogTrigger>
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => setDel(p)}><Trash2 className="size-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>Archive project</DialogTitle></DialogHeader>
          <p className="text-sm">Archive <b>{del?.name}</b>? It will be hidden but historical records remain intact.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDel(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => remove.mutate(del.id)} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="size-4 animate-spin" />} Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectDialog({ defaults, onSubmit, pending }: { defaults: any; onSubmit: (v: FormT) => void; pending: boolean }) {
  const [v, setV] = useState<FormT>({
    code: defaults?.code ?? "",
    name: defaults?.name ?? "",
    client_name: defaults?.client_name ?? "",
    location: defaults?.location ?? "",
    start_date: defaults?.start_date ?? "",
    end_date: defaults?.end_date ?? "",
    status: (defaults?.status as any) ?? "planning",
  });
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(v);
    if (!r.success) { setErr(r.error.issues[0].message); return; }
    setErr(null); onSubmit(r.data);
  };
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{defaults ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <F label="Project code *"><Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></F>
        <F label="Project name *"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></F>
        <F label="Client"><Input value={v.client_name ?? ""} onChange={(e) => setV({ ...v, client_name: e.target.value })} /></F>
        <F label="Location"><Input value={v.location ?? ""} onChange={(e) => setV({ ...v, location: e.target.value })} /></F>
        <F label="Start date"><Input type="date" value={v.start_date ?? ""} onChange={(e) => setV({ ...v, start_date: e.target.value })} /></F>
        <F label="End date"><Input type="date" value={v.end_date ?? ""} onChange={(e) => setV({ ...v, end_date: e.target.value })} /></F>
        <F label="Status">
          <Select value={v.status} onValueChange={(x) => setV({ ...v, status: x as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        {err && <p className="sm:col-span-2 text-xs text-destructive">{err}</p>}
        <DialogFooter className="sm:col-span-2">
          <Button type="submit" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium">{label}</Label>{children}</div>;
}
