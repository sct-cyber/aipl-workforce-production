import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ban, Search, PlusCircle, History } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { BLACKLIST_CATEGORIES, categoryLabel } from "@/lib/blacklist";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/blacklist/")({
  component: BlacklistList,
});

function BlacklistList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, hasRole } = useRoles();
  const canRemove = isAdmin || hasRole("hr");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [tab, setTab] = useState<"active" | "history">("active");

  const list = useQuery({
    queryKey: ["blacklist", { cat, tab }],
    queryFn: async () => {
      let query = supabase.from("blacklist_entries")
        .select("*, worker:workers(full_name, worker_code, kyc_id, phone)")
        .order("added_at", { ascending: false });
      query = tab === "active" ? query.eq("active", true) : query.eq("active", false);
      if (cat !== "all") query = query.eq("category", cat as any);
      return (await query).data ?? [];
    },
  });

  const filtered = (list.data ?? []).filter((r: any) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return r.worker?.full_name?.toLowerCase().includes(t)
      || r.worker?.worker_code?.toLowerCase().includes(t)
      || r.worker?.kyc_id?.toLowerCase().includes(t)
      || r.reason?.toLowerCase().includes(t)
      || r.previous_project?.toLowerCase?.().includes(t);
  });

  const deactivate = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("blacklist_entries").update({
        active: false, deactivated_by: user?.id, deactivated_at: new Date().toISOString(),
        deactivation_reason: reason,
      }).eq("id", id);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        actor_id: user?.id, action: "blacklist.remove", entity_type: "blacklist_entries", entity_id: id,
        changes: { reason },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blacklist"] }); toast.success("Removed from blacklist"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Blacklist Registry"
        description="Workers flagged for theft, violence, fraud, substance abuse, safety violations, absconding or other misconduct."
        actions={<Button asChild variant="destructive"><Link to="/blacklist/new"><PlusCircle className="size-4" /> Add to blacklist</Link></Button>}
      />

      <Card className="p-3 mb-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search worker, KYC ID, reason, project…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {BLACKLIST_CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="active"><Ban className="size-4" /> Active</TabsTrigger>
          <TabsTrigger value="history"><History className="size-4" /> History (removed)</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <Card>
            <Table className="table-dense">
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="hidden md:table-cell">Previous project</TableHead>
                  <TableHead className="hidden md:table-cell">{tab === "active" ? "Added" : "Removed"}</TableHead>
                  {tab === "active" && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={tab === "active" ? 6 : 5} className="py-12 text-center text-sm text-muted-foreground">
                      <Ban className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                      {tab === "active" ? "No workers on blacklist." : "No removal history."}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to="/workers/$id" params={{ id: r.worker_id }} className="font-medium hover:underline">
                        {r.worker?.full_name}
                      </Link>
                      <div className="text-xs text-muted-foreground font-mono">{r.worker?.kyc_id ?? r.worker?.worker_code}</div>
                    </TableCell>
                    <TableCell><Badge variant="destructive">{categoryLabel(r.category)}</Badge></TableCell>
                    <TableCell className="max-w-[360px]">
                      <div className="truncate">{r.reason}</div>
                      {tab === "history" && r.deactivation_reason && (
                        <div className="text-xs text-muted-foreground truncate">Removed: {r.deactivation_reason}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {r.previous_project ?? "—"}
                      {r.previous_designation && <div className="text-xs text-muted-foreground">{r.previous_designation}</div>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{fmtDate(tab === "active" ? r.added_at : r.deactivated_at)}</TableCell>
                    {tab === "active" && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canRemove}
                          title={canRemove ? "" : "Only Admin or HR can remove"}
                          onClick={() => {
                            const reason = prompt("Reason for removing from blacklist (min 10 chars):");
                            if (!reason || reason.trim().length < 10) return toast.error("Reason must be at least 10 characters.");
                            deactivate.mutate({ id: r.id, reason: reason.trim() });
                          }}
                        >Remove</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
