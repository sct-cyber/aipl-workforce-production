import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ChevronsUpDown, Loader2, Ban, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BLACKLIST_CATEGORIES } from "@/lib/blacklist";

export const Route = createFileRoute("/_authenticated/blacklist/new")({
  validateSearch: (s: Record<string, unknown>) => z.object({ workerId: z.string().optional() }).parse(s),
  component: NewBlacklist,
});

function NewBlacklist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workerId } = Route.useSearch();
  const [selected, setSelected] = useState(workerId);
  const [category, setCategory] = useState<string>("other");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const workers = useQuery({
    queryKey: ["workers-search-blk", q],
    queryFn: async () => {
      let query = supabase.from("workers").select("id, full_name, worker_code").neq("status", "blacklisted").limit(30);
      if (q.trim()) query = query.or(`full_name.ilike.%${q}%,worker_code.ilike.%${q}%`);
      return (await query).data ?? [];
    },
  });

  const worker = useQuery({
    queryKey: ["worker-select-blk", selected],
    enabled: !!selected,
    queryFn: async () => (await supabase.from("workers")
      .select("id, full_name, worker_code, kyc_id, designation, project:projects(name, code)")
      .eq("id", selected!).single()).data as any,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Select worker");
      if (!reason.trim() || reason.trim().length < 10) throw new Error("Reason must be at least 10 characters");
      const w: any = worker.data;
      const projectSnap = w?.project ? `${w.project.name}${w.project.code ? ` (${w.project.code})` : ""}` : null;
      const { error } = await supabase.from("blacklist_entries").insert({
        worker_id: selected,
        category: category as any,
        reason: reason.trim(),
        added_by: user?.id,
        previous_project: projectSnap,
        previous_designation: w?.designation ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Added to blacklist"); navigate({ to: "/blacklist" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Add to Blacklist"
        description="This action will mark the worker as blacklisted and block future advances."
        breadcrumbs={[{ label: "Blacklist", to: "/blacklist" }, { label: "New" }]}
      />

      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="size-4" />
        <AlertTitle>Governance action</AlertTitle>
        <AlertDescription>Blacklisting is auditable. Provide a clear reason and category. Attach evidence where possible.</AlertDescription>
      </Alert>

      <Card className="max-w-3xl">
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Worker *</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between mt-1.5 font-normal">
                  {worker.data ? `${worker.data.full_name} · ${worker.data.worker_code}` : "Select worker…"}
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command shouldFilter={false}>
                  <CommandInput value={q} onValueChange={setQ} placeholder="Search…" />
                  <CommandList>
                    <CommandEmpty>No workers</CommandEmpty>
                    {(workers.data ?? []).map((w: any) => (
                      <CommandItem key={w.id} value={w.id} onSelect={() => { setSelected(w.id); setOpen(false); }}>
                        <Check className={cn("size-4", selected === w.id ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0"><div className="font-medium">{w.full_name}</div><div className="text-xs text-muted-foreground font-mono">{w.worker_code}</div></div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BLACKLIST_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason *</Label>
            <Textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} className="mt-1.5" placeholder="Describe the incident with dates and specifics…" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate({ to: "/blacklist" })}>Cancel</Button>
            <Button variant="destructive" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} Blacklist worker
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
