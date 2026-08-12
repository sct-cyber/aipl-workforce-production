import { useState } from "react";
import { AlertTriangle, ShieldAlert, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { fmtDate, maskAadhaar } from "@/lib/format";
import { categoryLabel, type BlacklistHit } from "@/lib/blacklist";
import { toast } from "sonner";

interface Props {
  hit: BlacklistHit;
  onClose: () => void;
  /** Called after an admin/HR successfully overrides so the caller can proceed. */
  onOverride?: (reason: string) => void;
}

export function BlacklistWarning({ hit, onClose, onOverride }: Props) {
  const { user } = useAuth();
  const { isAdmin, hasRole, loading } = useRoles();
  const canOverride = !loading && (isAdmin || hasRole("hr"));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitOverride = async () => {
    if (!reason.trim() || reason.trim().length < 10) {
      return toast.error("Override reason must be at least 10 characters.");
    }
    setSubmitting(true);
    try {
      // Audit trail — required for every override
      const { error } = await supabase.from("audit_log").insert({
        actor_id: user?.id ?? null,
        action: "blacklist.override",
        entity_type: "blacklist_entries",
        entity_id: hit.entry_id,
        changes: {
          worker_id: hit.worker_id,
          worker_name: hit.full_name,
          aadhaar: hit.aadhaar_number,
          category: hit.category,
          override_reason: reason.trim(),
          at: new Date().toISOString(),
        },
      });
      if (error) throw error;
      // Stamp override metadata on the entry itself
      await supabase.from("blacklist_entries").update({
        override_by: user?.id, override_at: new Date().toISOString(), override_reason: reason.trim(),
      } as any).eq("id", hit.entry_id);
      toast.success("Override recorded in audit log.");
      onOverride?.(reason.trim());
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to record override.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-red-700/95 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="alertdialog"
      aria-labelledby="blk-warning-title"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white"
        aria-label="Close warning"
      >
        <X className="size-6" />
      </button>

      <div className="w-full max-w-2xl rounded-2xl bg-white text-foreground shadow-2xl overflow-hidden border-4 border-red-900">
        <div className="bg-red-700 text-white px-6 py-4 flex items-center gap-3">
          <ShieldAlert className="size-8 shrink-0" />
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold opacity-90">Blacklist match</div>
            <h2 id="blk-warning-title" className="text-2xl font-bold leading-tight">
              This Aadhaar is BLACKLISTED
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Info k="Worker name" v={hit.full_name} strong />
            <Info k="Aadhaar" v={maskAadhaar(hit.aadhaar_number ?? "")} mono />
            <Info k="Reason category" v={categoryLabel(hit.category)} pill />
            <Info k="Blacklist date" v={fmtDate(hit.added_at)} />
            <Info k="Previous project" v={hit.previous_project ?? "—"} />
            <Info k="Previous designation" v={hit.previous_designation ?? "—"} />
          </div>

          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <div className="text-xs uppercase tracking-wide text-red-700 font-semibold mb-1">Reason on record</div>
            <p className="text-sm text-red-900 whitespace-pre-wrap">{hit.reason}</p>
          </div>

          {canOverride ? (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="size-4 text-amber-600" /> Override (Admin / HR only)
              </div>
              <Label className="text-xs">Justification (min 10 chars) — recorded in audit log</Label>
              <Textarea
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Explain why this worker may proceed despite being blacklisted…"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button variant="destructive" onClick={submitOverride} disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
                  Override & continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              You do not have permission to override this blacklist entry. Only <span className="font-semibold text-foreground">Admin</span> or <span className="font-semibold text-foreground">HR</span> can proceed.
              <div className="mt-3 flex justify-end">
                <Button variant="outline" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ k, v, mono, strong, pill }: { k: string; v: string; mono?: boolean; strong?: boolean; pill?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{k}</div>
      <div className={`mt-0.5 text-sm ${mono ? "font-mono" : ""} ${strong ? "font-bold text-base" : "font-medium"}`}>
        {pill ? <span className="inline-block px-2 py-0.5 rounded bg-red-600 text-white text-xs uppercase font-semibold">{v}</span> : v}
      </div>
    </div>
  );
}
