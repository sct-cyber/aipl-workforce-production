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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, ShieldAlert, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/templates")({
  component: TemplatesMaster,
});

const CATEGORIES = ["worker", "advance", "blacklist", "project", "other"] as const;

const schema = z.object({
  code: z.string().trim().min(1, "Required").max(60),
  name: z.string().trim().min(1, "Required").max(160),
  category: z.enum(CATEGORIES),
  description: z.string().max(500).optional().or(z.literal("")),
  content: z.string().max(20000).optional().or(z.literal("")),
  active: z.boolean(),
});
type FormT = z.infer<typeof schema>;

function TemplatesMaster() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isStaff } = useRoles();
  const [edit, setEdit] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<any>(null);

  const list = useQuery({
    queryKey: ["templates-master"],
    queryFn: async () => (await supabase.from("document_templates").select("*").is("deleted_at", null).order("name")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: FormT & { id?: string }) => {
      const payload: any = {
        code: v.code, name: v.name, category: v.category,
        description: v.description || null, content: v.content || "", active: v.active,
      };
      if (v.id) {
        payload.updated_by = user?.id;
        const { error } = await supabase.from("document_templates").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("document_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setOpen(false); setEdit(null); qc.invalidateQueries({ queryKey: ["templates-master"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_templates").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Template archived"); setDel(null); qc.invalidateQueries({ queryKey: ["templates-master"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  if (!isStaff) return <Alert><ShieldAlert className="size-4" /><AlertDescription>Staff access required.</AlertDescription></Alert>;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="p-4 flex items-center justify-between border-b">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <h2 className="font-semibold">Document Templates</h2>
              <Badge variant="secondary">{list.data?.length ?? 0}</Badge>
            </div>
            {isAdmin && (
              <Dialog open={open && !edit} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
                <DialogTrigger asChild><Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="size-4" /> New template</Button></DialogTrigger>
                <TemplateDialog defaults={null} onSubmit={(v) => save.mutate(v)} pending={save.isPending} />
              </Dialog>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-24 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data?.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No templates yet.</TableCell></TableRow>}
              {list.data?.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.code}</TableCell>
                  <TableCell className="font-medium">{t.name}<div className="text-xs text-muted-foreground">{t.description}</div></TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{t.category}</Badge></TableCell>
                  <TableCell><Badge variant={t.active ? "default" : "secondary"}>{t.active ? "Active" : "Inactive"}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <Dialog open={edit?.id === t.id} onOpenChange={(o) => setEdit(o ? t : null)}>
                        <DialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => setEdit(t)}><Pencil className="size-4" /></Button></DialogTrigger>
                        <TemplateDialog defaults={t} onSubmit={(v) => save.mutate({ ...v, id: t.id })} pending={save.isPending} />
                      </Dialog>
                      <Button variant="ghost" size="icon" onClick={() => setDel(t)}><Trash2 className="size-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>Archive template</DialogTitle></DialogHeader>
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

function TemplateDialog({ defaults, onSubmit, pending }: { defaults: any; onSubmit: (v: FormT) => void; pending: boolean }) {
  const [v, setV] = useState<FormT>({
    code: defaults?.code ?? "",
    name: defaults?.name ?? "",
    category: (defaults?.category as any) ?? "worker",
    description: defaults?.description ?? "",
    content: defaults?.content ?? "",
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
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{defaults ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Code *"><Input value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} /></F>
          <F label="Name *"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></F>
        </div>
        <F label="Category">
          <Select value={v.category} onValueChange={(x) => setV({ ...v, category: x as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="Description"><Input value={v.description ?? ""} onChange={(e) => setV({ ...v, description: e.target.value })} /></F>
        <F label="Content (supports {{variables}})">
          <Textarea rows={8} value={v.content ?? ""} onChange={(e) => setV({ ...v, content: e.target.value })} className="font-mono text-xs" />
        </F>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="text-sm font-medium">Active</div>
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
