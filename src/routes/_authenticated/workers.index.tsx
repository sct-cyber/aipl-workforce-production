import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserPlus, Search, Download, Filter, Eye } from "lucide-react";
import { fmtDate, initials } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/workers/")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ q: z.string().optional(), status: z.string().optional(), dept: z.string().optional() }).parse(s),
  component: WorkersList,
});

function WorkersList() {
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [status, setStatus] = useState(search.status ?? "all");
  const [dept, setDept] = useState(search.dept ?? "all");

  const list = useQuery({
    queryKey: ["workers", { q, status, dept }],
    queryFn: async () => {
      let query = supabase.from("workers").select("*").order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status as any);
      if (dept !== "all") query = query.eq("department", dept);
      if (q.trim()) query = query.or(`full_name.ilike.%${q}%,worker_code.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const depts = useMemo(() => {
    const s = new Set<string>();
    (list.data ?? []).forEach((w: any) => w.department && s.add(w.department));
    return Array.from(s);
  }, [list.data]);

  const exportCsv = () => {
    const rows = list.data ?? [];
    if (!rows.length) return;
    const cols = ["worker_code", "full_name", "phone", "department", "designation", "date_of_joining", "status"];
    const csv = [cols.join(","), ...rows.map((r: any) => cols.map(c => JSON.stringify(r[c] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `workers-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const toneFor = (s: string) => s === "active" ? "success" : s === "blacklisted" ? "danger" : "neutral";

  return (
    <>
      <PageHeader
        title="Worker KYC Registry"
        description="Master list of workers with verified KYC details."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Export</Button>
            <Button asChild><Link to="/workers/new"><UserPlus className="size-4" /> Add worker</Link></Button>
          </>
        }
      />

      <Card className="p-3 mb-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search name, code, phone…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blacklisted">Blacklisted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {depts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => { setQ(""); setStatus("all"); setDept("all"); }}>
            <Filter className="size-4" /> Reset
          </Button>
        </div>
      </Card>

      <Card>
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>Worker</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead className="hidden md:table-cell">Designation</TableHead>
              <TableHead className="hidden lg:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {!list.isLoading && (list.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                No workers found. <Link to="/workers/new" className="text-primary font-medium">Add your first worker</Link>.
              </TableCell></TableRow>
            )}
            {(list.data ?? []).map((w: any) => (
              <TableRow key={w.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="size-8"><AvatarFallback className="text-[10px] bg-muted">{initials(w.full_name)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{w.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{w.father_name ? `S/o ${w.father_name}` : "—"}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{w.worker_code}</TableCell>
                <TableCell className="hidden md:table-cell">{w.department ?? "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{w.designation ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell font-mono text-xs">{w.phone ?? "—"}</TableCell>
                <TableCell className="hidden lg:table-cell">{fmtDate(w.date_of_joining)}</TableCell>
                <TableCell><StatusPill status={w.status} tone={toneFor(w.status) as any} /></TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/workers/$id" params={{ id: w.id }}><Eye className="size-4" /></Link>
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
