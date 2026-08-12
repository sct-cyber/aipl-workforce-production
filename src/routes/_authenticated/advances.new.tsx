import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, ChevronsUpDown, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { ADVANCE_TYPES, type AdvanceType, requiredApprovals } from "@/lib/advances";

export const Route = createFileRoute("/_authenticated/advances/new")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ workerId: z.string().optional() }).parse(s),
  component: NewAdvance,
});

function NewAdvance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workerId } = Route.useSearch();

  const [selected, setSelected] = useState<string | undefined>(workerId);
  const [projectId, setProjectId] = useState<string>("");
  const [type, setType] = useState<AdvanceType>("salary");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [recoveryMonth, setRecoveryMonth] = useState(""); // yyyy-mm
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const workers = useQuery({
    queryKey: ["workers-search-adv", q],
    queryFn: async () => {
      let query = supabase.from("workers")
        .select("id, full_name, worker_code, kyc_id, phone, project_id, department, designation")
        .eq("status", "active").is("deleted_at", null).limit(30);
      if (q.trim()) query = query.or(`full_name.ilike.%${q}%,worker_code.ilike.%${q}%,kyc_id.ilike.%${q}%,phone.ilike.%${q}%`);
      return (await query).data ?? [];
    },
  });

  const worker = useQuery({
    queryKey: ["worker-select-adv", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase.from("workers").select("*").eq("id", selected!).single();
      if (data?.project_id && !projectId) setProjectId(data.project_id);
      return data;
    },
  });

  const projects = useQuery({
    queryKey: ["projects-active-adv"],
    queryFn: async () => (await supabase.from("projects")
      .select("id, name, code").eq("status", "active").is("deleted_at", null).order("name")).data ?? [],
  });

  const amt = Number(amount) || 0;
  const matrix = useMemo(() => requiredApprovals(amt), [amt]);
  const recAmt = Number(recoveryAmount) || 0;
  const months = recAmt > 0 ? Math.ceil(amt / recAmt) : 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select a worker");
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      if (!reason.trim() || reason.trim().length < 5) throw new Error("Please describe the reason");
      if (!recoveryMonth) throw new Error("Recovery start month is required");
      if (!recAmt || recAmt <= 0) throw new Error("Recovery amount is required");
      if (recAmt > amt) throw new Error("Recovery amount cannot exceed the advance amount");

      const payload: any = {
        worker_id: selected,
        project_id: projectId || (worker.data as any)?.project_id || null,
        advance_type: type,
        amount: amt,
        reason: reason.trim(),
        recovery_month: `${recoveryMonth}-01`,
        recovery_amount: recAmt,
        created_by: user?.id,
        status: "pending",
      };
      const { data, error } = await supabase.from("advances").insert(payload).select().single();
      if (error) throw error;

      // Seed installment ledger for the recovery schedule
      const rows = [];
      let remaining = amt;
      const [yy, mm] = recoveryMonth.split("-").map(Number);
      for (let i = 0; i < months; i++) {
        const due = new Date(yy, mm - 1 + i, 1);
        const inst = Math.min(recAmt, remaining);
        rows.push({
          advance_id: data.id,
          amount: inst,
          due_date: due.toISOString().slice(0, 10),
          status: "pending",
        });
        remaining -= inst;
      }
      if (rows.length) await supabase.from("advance_installments").insert(rows);

      return data;
    },
    onSuccess: (a) => { toast.success("Advance request submitted"); navigate({ to: "/advances/$id", params: { id: a.id } }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="New Advance Request"
        description="Submit an advance request. The approval matrix below routes it to the right approvers."
        breadcrumbs={[{ label: "Advances", to: "/advances" }, { label: "New" }]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Request details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Worker *</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between mt-1.5 font-normal">
                      {worker.data ? `${worker.data.full_name} · ${(worker.data as any).kyc_id ?? worker.data.worker_code}` : "Search worker by name, KYC ID or phone…"}
                      <ChevronsUpDown className="size-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Type to search…" value={q} onValueChange={setQ} />
                      <CommandList>
                        <CommandEmpty>No workers found</CommandEmpty>
                        {(workers.data ?? []).map((w: any) => (
                          <CommandItem key={w.id} value={w.id} onSelect={() => { setSelected(w.id); setProjectId(w.project_id ?? ""); setOpen(false); }}>
                            <Check className={cn("size-4", selected === w.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{w.full_name}</div>
                              <div className="text-xs text-muted-foreground font-mono">{w.kyc_id ?? w.worker_code}</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>Project</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder={projects.data?.length ? "Select project" : "No projects"} /></SelectTrigger>
                  <SelectContent>
                    {projects.data?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Advance type *</Label>
                <Select value={type} onValueChange={(v) => setType(v as AdvanceType)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADVANCE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount (₹) *</Label>
                <Input type="number" min={1} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="mt-1.5 font-mono text-lg" />
                {amt > 0 && <p className="text-xs text-muted-foreground mt-1">{inr(amt)}</p>}
              </div>

              <div>
                <Label>Recovery start month *</Label>
                <Input type="month" value={recoveryMonth} onChange={e => setRecoveryMonth(e.target.value)} className="mt-1.5" />
              </div>

              <div>
                <Label>Monthly recovery amount (₹) *</Label>
                <Input type="number" min={1} value={recoveryAmount} onChange={e => setRecoveryAmount(e.target.value)} placeholder="0" className="mt-1.5 font-mono" />
                {months > 0 && <p className="text-xs text-muted-foreground mt-1">≈ {months} installment{months === 1 ? "" : "s"}</p>}
              </div>
            </div>

            <div>
              <Label>Reason *</Label>
              <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Medical, family emergency, festival, tool purchase, travel…" className="mt-1.5" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="size-4" /> Approval matrix</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {matrix.length === 0 ? (
                <p className="text-muted-foreground">Enter an amount to see required approvers.</p>
              ) : (
                <ol className="space-y-2">
                  {matrix.map(step => (
                    <li key={step.step} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{step.step}</Badge>
                      <span className="font-medium">{step.label}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="pt-2 border-t text-xs text-muted-foreground space-y-0.5">
                <div>≤ ₹5,000 → Labour Incharge</div>
                <div>₹5,001–₹20,000 → Project Manager</div>
                <div>&gt; ₹20,000 → HR + Accounts</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row k="Worker" v={worker.data?.full_name ?? "—"} />
              <Row k="Type" v={ADVANCE_TYPES.find(t => t.value === type)?.label ?? "—"} />
              <Row k="Amount" v={amt ? inr(amt) : "—"} strong />
              <Row k="Recovery" v={recAmt ? `${inr(recAmt)} × ${months} mo` : "—"} />
              <Row k="Status" v="Pending approval" />
              <Button className="w-full mt-2" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Submit request
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={cn("font-medium tabular-nums truncate ml-4", strong && "font-bold text-primary")}>{v}</span>
    </div>
  );
}
