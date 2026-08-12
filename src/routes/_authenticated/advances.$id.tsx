import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { PageHeader, StatusPill } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Check, X, IndianRupee, Calendar, User, FileText, Send,
  CheckCircle2, XCircle, Clock, ShieldCheck, ScrollText, Pencil, Trash2, Plus, AlertTriangle,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { inr, fmtDate, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { advanceTypeLabel, advanceStatusTone, requiredApprovals, nextApprovalStep } from "@/lib/advances";
import { ROLE_LABELS } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/advances/$id")({
  component: AdvanceDetail,
});

function AdvanceDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { roles, isAdmin } = useRoles();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);


  const a = useQuery({
    queryKey: ["advance", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("advances")
        .select("*, worker:workers(id, full_name, worker_code, kyc_id, phone, department, designation), project:projects(name, code)")
        .eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  const approvals = useQuery({
    queryKey: ["advance-approvals", id],
    queryFn: async () => (await supabase.from("advance_approvals")
      .select("*").eq("advance_id", id).order("step", { ascending: true })).data ?? [],
  });

  const installments = useQuery({
    queryKey: ["advance-installments", id],
    queryFn: async () => (await supabase.from("advance_installments")
      .select("*").eq("advance_id", id).order("due_date", { ascending: true })).data ?? [],
  });

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("advances").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["advance", id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const recordDecision = useMutation({
    mutationFn: async (input: { decision: "approved" | "rejected"; comments: string; step: number; role: string }) => {
      const { error } = await supabase.from("advance_approvals").insert({
        advance_id: id, approver_id: user?.id, step: input.step,
        decision: input.decision, comments: input.comments || null,
        approver_role: input.role,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advance-approvals", id] });
      qc.invalidateQueries({ queryKey: ["advance", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markInstallmentPaid = useMutation({
    mutationFn: async ({ instId, paidAmount }: { instId: string; paidAmount: number }) => {
      const { error } = await supabase.from("advance_installments").update({
        status: "paid", paid_amount: paidAmount, paid_at: new Date().toISOString(),
      }).eq("id", instId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advance-installments", id] });
      toast.success("Installment recovered");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addRecovery = useMutation({
    mutationFn: async (input: { amount: number; date: string; mode: string; remarks: string }) => {
      const { error } = await supabase.from("advance_installments").insert({
        advance_id: id,
        amount: input.amount,
        due_date: input.date,
        status: "paid",
        paid_amount: input.amount,
        paid_at: new Date(input.date).toISOString(),
        payment_mode: input.mode,
        remarks: input.remarks || null,
        entered_by: user?.id ?? null,
        is_manual: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advance-installments", id] });
      toast.success("Recovery recorded");
      setRecoveryOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editAdvance = useMutation({
    mutationFn: async (patch: { amount: number; reason: string; recovery_amount: number | null }) => {
      const { error } = await supabase.from("advances").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advance", id] });
      toast.success("Advance updated");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAdvance = useMutation({
    mutationFn: async () => {
      // Soft delete: mark deleted_at
      const { error } = await supabase
        .from("advances")
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Advance deleted");
      navigate({ to: "/advances" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (a.isLoading) return <Skeleton className="h-40 w-full" />;
  if (!a.data) return <div>Not found</div>;
  const adv = a.data;

  const matrix = requiredApprovals(Number(adv.amount));
  const approvalRows = (approvals.data ?? []) as Array<{ step: number; decision: string }>;
  const nextStep = nextApprovalStep(Number(adv.amount), approvalRows);
  const isRejected = approvalRows.some(r => r.decision === "rejected") || adv.status === "rejected";
  const isFullyApproved = !nextStep && matrix.length > 0 && !isRejected;

  // The current user can act if their role matches the next required step (or Admin/Super Admin override)
  const canActOnNext = !!nextStep && !isRejected && adv.status === "pending" && (
    isAdmin || roles.includes(nextStep.role as any)
  );

  const submitDecision = async (decision: "approved" | "rejected", comments: string) => {
    if (!nextStep) return;
    await recordDecision.mutateAsync({ decision, comments, step: nextStep.step, role: nextStep.role });
    // Roll up to advance status
    if (decision === "rejected") {
      await update.mutateAsync({ status: "rejected", rejection_reason: comments || null });
      toast.success("Advance rejected");
    } else {
      const nowApproved = [...approvalRows, { step: nextStep.step, decision: "approved" }];
      const stillNeeded = nextApprovalStep(Number(adv.amount), nowApproved);
      if (!stillNeeded) {
        await update.mutateAsync({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() });
        toast.success("Advance fully approved");
      } else {
        toast.success(`Approved — awaiting ${stillNeeded.label}`);
      }
    }
    setApproveOpen(false); setApproveComment("");
    setRejectOpen(false); setRejectReason("");
  };

  const disburse = () => update.mutate({ status: "disbursed", disbursed_at: new Date().toISOString() }, {
    onSuccess: () => toast.success("Marked as disbursed"),
  });

  const totalRecovered = (installments.data ?? []).filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.paid_amount ?? 0), 0);
  const outstanding = Math.max(0, Number(adv.amount) - totalRecovered);
  const pctRecovered = adv.amount ? Math.round((totalRecovered / Number(adv.amount)) * 100) : 0;

  if (adv.status === "disbursed" && outstanding === 0 && (installments.data ?? []).length > 0) {
    update.mutate({ status: "repaid" });
  }

  return (
    <>
      <PageHeader
        title={`Advance ${adv.advance_code}`}
        description={`${advanceTypeLabel(adv.advance_type)} for ${adv.worker?.full_name ?? "—"}`}
        breadcrumbs={[{ label: "Advances", to: "/advances" }, { label: adv.advance_code }]}
        actions={
          <>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-4" /> Delete
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/advances"><ArrowLeft className="size-4" /> Back</Link>
            </Button>
          </>
        }

      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Request details</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{advanceTypeLabel(adv.advance_type)}</Badge>
              <StatusPill status={adv.status} tone={advanceStatusTone(adv.status) as any} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-6 text-center bg-gradient-to-br from-primary/5 to-transparent">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Amount requested</div>
              <div className="mt-1 font-display text-4xl font-bold text-primary tabular-nums">{inr(adv.amount)}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              <Info icon={User} label="Worker" v={adv.worker?.full_name ?? "—"} sub={adv.worker?.kyc_id ?? adv.worker?.worker_code} />
              <Info icon={Calendar} label="Requested" v={fmtDate(adv.request_date)} />
              <Info icon={FileText} label="Reason" v={adv.reason ?? "—"} />
              <Info icon={IndianRupee} label="Recovery" v={adv.recovery_amount ? `${inr(adv.recovery_amount)} / month` : "—"} sub={adv.recovery_month ? `from ${fmtDate(adv.recovery_month)}` : undefined} />
              <Info icon={FileText} label="Project" v={adv.project?.name ?? "—"} />
            </div>
            {adv.rejection_reason && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <div className="font-semibold text-destructive mb-1">Rejected</div>
                <p className="text-muted-foreground">{adv.rejection_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="size-4" /> Approval matrix</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {matrix.map(step => {
                const rec = approvalRows.find(a => a.step === step.step) as any;
                const isNext = nextStep?.step === step.step && !isRejected;
                return (
                  <div key={step.step} className={`flex items-center gap-2 rounded-md border p-2 ${isNext ? "border-primary bg-primary/5" : ""}`}>
                    {rec?.decision === "approved" ? <CheckCircle2 className="size-4 text-emerald-600" />
                      : rec?.decision === "rejected" ? <XCircle className="size-4 text-destructive" />
                      : <Clock className="size-4 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">Step {step.step} · {step.label}</div>
                      {rec && <div className="text-xs text-muted-foreground truncate">{fmtDateTime(rec.created_at)}</div>}
                    </div>
                  </div>
                );
              })}
              {canActOnNext && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => setApproveOpen(true)}><Check className="size-4" /> Approve</Button>
                  <Button variant="destructive" className="flex-1" onClick={() => setRejectOpen(true)}><X className="size-4" /> Reject</Button>
                </div>
              )}
              {!canActOnNext && nextStep && !isRejected && adv.status === "pending" && (
                <p className="text-xs text-muted-foreground pt-2">Awaiting {nextStep.label} approval.</p>
              )}
              {isFullyApproved && adv.status === "approved" && (
                <Button className="w-full" onClick={disburse}><Send className="size-4" /> Mark disbursed</Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Approval history */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScrollText className="size-4" /> Approval history</CardTitle></CardHeader>
        <CardContent>
          {(approvals.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No approval activity yet.</p>
          ) : (
            <div className="space-y-2">
              {(approvals.data ?? []).map((row: any) => (
                <div key={row.id} className="flex items-start gap-3 rounded-md border p-3">
                  {row.decision === "approved" ? <CheckCircle2 className="size-4 text-emerald-600 mt-0.5" /> : <XCircle className="size-4 text-destructive mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      Step {row.step} · {ROLE_LABELS[(row.approver_role ?? "viewer") as keyof typeof ROLE_LABELS] ?? row.approver_role} · {row.decision}
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(row.created_at)}</div>
                    {row.comments && <p className="text-sm mt-1">{row.comments}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recovery ledger */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><IndianRupee className="size-4" /> Recovery ledger</CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-sm hidden sm:block">
              <span className="text-muted-foreground">Recovered </span>
              <span className="font-semibold tabular-nums">{inr(totalRecovered)}</span>
              <span className="text-muted-foreground"> / {inr(adv.amount)} ({pctRecovered}%)</span>
            </div>
            {(isAdmin || roles.includes("accounts") || roles.includes("hr")) && outstanding > 0 && (
              <Button size="sm" onClick={() => setRecoveryOpen(true)}>
                <Plus className="size-4" /> Add Recovery
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(installments.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No recovery entries yet. Use "Add Recovery" to log a manual payment.</p>
          ) : (
            <div className="space-y-1">
              {(installments.data ?? []).map((inst: any) => (
                <InstallmentRow
                  key={inst.id}
                  inst={inst}
                  canRecover={adv.status === "disbursed" && (isAdmin || roles.includes("accounts") || roles.includes("hr"))}
                  onPay={(paidAmount) => markInstallmentPaid.mutate({ instId: inst.id, paidAmount })}
                />
              ))}
              <div className="flex justify-between border-t pt-3 mt-3 text-sm">
                <span className="font-medium">Outstanding</span>
                <span className="font-mono tabular-nums font-semibold">{inr(outstanding)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>


      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve as {nextStep?.label}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Comments (optional)</Label>
            <Textarea rows={3} value={approveComment} onChange={e => setApproveComment(e.target.value)} placeholder="Any notes…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button onClick={() => submitDecision("approved", approveComment)} disabled={recordDecision.isPending}>Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject advance</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason (required)</Label>
            <Textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explain the rejection reason…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              if (!rejectReason.trim() || rejectReason.trim().length < 5) return toast.error("Rejection reason required (min 5 chars)");
              submitDecision("rejected", rejectReason.trim());
            }} disabled={recordDecision.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit advance */}
      <EditAdvanceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        advance={adv}
        onSubmit={(patch) => editAdvance.mutate(patch)}
        pending={editAdvance.isPending}
      />

      {/* Delete advance */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" /> Delete Advance?
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm space-y-2">
            <p>This action cannot be undone.</p>
            {adv.status === "approved" && (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-warning-foreground">
                <strong>Warning:</strong> this advance is already <b>approved</b>. Deleting it will remove
                the approval trail from active reports.
              </div>
            )}
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Advance</div>
              <div className="font-mono">{adv.advance_code}</div>
              <div className="text-xs text-muted-foreground mt-2">Amount</div>
              <div className="font-semibold">{inr(adv.amount)}</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteAdvance.mutate()} disabled={deleteAdvance.isPending}>
              <Trash2 className="size-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual recovery */}
      <RecoveryDialog
        open={recoveryOpen}
        onOpenChange={setRecoveryOpen}
        outstanding={outstanding}
        onSubmit={(v) => addRecovery.mutate(v)}
        pending={addRecovery.isPending}
      />

    </>
  );
}

function Info({ icon: Icon, label, v, sub }: { icon: any; label: string; v: string; sub?: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{v}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}

function InstallmentRow({ inst, canRecover, onPay }: { inst: any; canRecover: boolean; onPay: (n: number) => void }) {
  const [amt, setAmt] = useState(String(inst.amount));
  const paid = inst.status === "paid";
  return (
    <div className={`flex items-center gap-3 border rounded-md p-2 ${paid ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}`}>
      <Calendar className="size-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium flex items-center gap-2">
          {fmtDate(inst.due_date)}
          {inst.is_manual && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">Manual</Badge>}
          {inst.payment_mode && <Badge variant="outline" className="h-4 px-1.5 text-[10px] capitalize">{inst.payment_mode.replace("_", " ")}</Badge>}
        </div>
        {paid && <div className="text-xs text-muted-foreground">Paid {fmtDate(inst.paid_at)}</div>}
        {inst.remarks && <div className="text-xs text-muted-foreground truncate">{inst.remarks}</div>}
      </div>
      <div className="font-mono tabular-nums text-sm">{inr(paid ? inst.paid_amount : inst.amount)}</div>
      {paid ? (
        <Badge variant="outline" className="text-emerald-700 border-emerald-300">Paid</Badge>
      ) : canRecover ? (
        <div className="flex items-center gap-1">
          <Input type="number" value={amt} onChange={e => setAmt(e.target.value)} className="h-8 w-24 font-mono" />
          <Button size="sm" onClick={() => onPay(Number(amt) || 0)}>Mark paid</Button>
        </div>
      ) : (
        <Badge variant="outline">Pending</Badge>
      )}
    </div>
  );
}

function EditAdvanceDialog({
  open, onOpenChange, advance, onSubmit, pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  advance: any;
  onSubmit: (v: { amount: number; reason: string; recovery_amount: number | null }) => void;
  pending: boolean;
}) {
  const [amount, setAmount] = useState(String(advance.amount ?? ""));
  const [reason, setReason] = useState(advance.reason ?? "");
  const [recovery, setRecovery] = useState(String(advance.recovery_amount ?? ""));
  const needsConfirm = advance.status === "approved";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit advance {advance.advance_code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {needsConfirm && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
              This advance is already <b>approved</b>. Changes will override the approved values.
            </div>
          )}
          <div>
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <div>
            <Label>Monthly recovery amount (₹)</Label>
            <Input type="number" value={recovery} onChange={e => setRecovery(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const amt = Number(amount);
              if (!amt || amt <= 0) return toast.error("Enter a valid amount");
              onSubmit({
                amount: amt,
                reason: reason.trim(),
                recovery_amount: recovery ? Number(recovery) : null,
              });
            }}
            disabled={pending}
          >Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecoveryDialog({
  open, onOpenChange, outstanding, onSubmit, pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outstanding: number;
  onSubmit: (v: { amount: number; date: string; mode: string; remarks: string }) => void;
  pending: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("cash");
  const [remarks, setRemarks] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add manual recovery</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border p-2 text-xs text-muted-foreground">
            Outstanding: <span className="font-semibold text-foreground">{inr(outstanding)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Recovery date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 2000" />
            </div>
          </div>
          <div>
            <Label>Payment mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="salary_adjustment">Salary Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              const amt = Number(amount);
              if (!amt || amt <= 0) return toast.error("Enter a valid amount");
              if (amt > outstanding) return toast.error(`Amount exceeds outstanding ${inr(outstanding)}`);
              onSubmit({ amount: amt, date, mode, remarks: remarks.trim() });
            }}
            disabled={pending}
          >
            <Plus className="size-4" /> Record recovery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

