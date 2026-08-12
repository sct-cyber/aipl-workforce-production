import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PlusCircle, Search, Eye } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ADVANCE_TYPES, advanceTypeLabel, advanceStatusTone } from "@/lib/advances";

export const Route = createFileRoute("/_authenticated/advances/")({
  component: AdvancesList,
});

function AdvancesList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const list = useQuery({
    queryKey: ["advances", { q, status, type }],
    queryFn: async () => {
      let query = supabase
        .from("advances")
        .select("*, worker:workers(id, full_name, worker_code, kyc_id, phone)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (status !== "all") query = query.eq("status", status as any);
      if (type !== "all") query = query.eq("advance_type", type as any);
      const { data, error } = await query.limit(300);
      if (error) throw error;
      const rows = data ?? [];
      if (!q.trim()) return rows;
      const s = q.toLowerCase();
      return rows.filter((r: any) =>
        r.advance_code.toLowerCase().includes(s) ||
        r.worker?.full_name?.toLowerCase().includes(s) ||
        r.worker?.worker_code?.toLowerCase().includes(s) ||
        r.worker?.kyc_id?.toLowerCase().includes(s));
    },
  });

  return (
    <>
      <PageHeader
        title="Advance (Kharchi)"
        description="Track all advance requests, approvals, disbursements and repayments."
        actions={
          <Button asChild><Link to="/advances/new"><PlusCircle className="size-4" /> New advance</Link></Button>
        }
      />

      <Card className="p-3 mb-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search code, worker, KYC ID…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ADVANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="disbursed">Disbursed</SelectItem>
              <SelectItem value="repaid">Repaid</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="hidden lg:table-cell">Request date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && Array.from({ length: 5 }).map((_, i) =>
              <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>)}
            {!list.isLoading && (list.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                No advances yet.
              </TableCell></TableRow>
            )}
            {(list.data ?? []).map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.advance_code}</TableCell>
                <TableCell>
                  <div className="font-medium">{a.worker?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground font-mono">{a.worker?.kyc_id ?? a.worker?.worker_code}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell"><Badge variant="secondary">{advanceTypeLabel(a.advance_type)}</Badge></TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{inr(a.amount)}</TableCell>
                <TableCell className="hidden lg:table-cell">{fmtDate(a.request_date)}</TableCell>
                <TableCell><StatusPill status={a.status} tone={advanceStatusTone(a.status) as any} /></TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/advances/$id" params={{ id: a.id }}><Eye className="size-4" /></Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
