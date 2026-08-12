import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusPill } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Ban, HandCoins, Phone, Mail, MapPin, Landmark, Calendar, ShieldCheck, QrCode, Download } from "lucide-react";
import { fmtDate, initials, inr, maskAadhaar } from "@/lib/format";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRef } from "react";

export const Route = createFileRoute("/_authenticated/workers/$id")({
  component: WorkerDetail,
});

function WorkerDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const w = useQuery({
    queryKey: ["worker", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("workers").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const advs = useQuery({
    queryKey: ["worker-advances", id],
    queryFn: async () => (await supabase.from("advances").select("*").eq("worker_id", id).order("created_at", { ascending: false })).data ?? [],
  });

  const blk = useQuery({
    queryKey: ["worker-blacklist", id],
    queryFn: async () => (await supabase.from("blacklist_entries").select("*").eq("worker_id", id).order("added_at", { ascending: false })).data ?? [],
  });

  const setStatus = useMutation({
    mutationFn: async (status: "active" | "inactive" | "blacklisted") => {
      const { error } = await supabase.from("workers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker", id] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (w.isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-64" /><Skeleton className="h-40 w-full" /></div>;
  if (!w.data) return <div>Not found.</div>;

  const worker = w.data as any;
  const toneFor = (s: string) => s === "active" ? "success" : s === "blacklisted" ? "danger" : "neutral";

  return (
    <>
      <PageHeader
        title={worker.full_name}
        description={`${worker.designation ?? "—"}${worker.department ? " · " + worker.department : ""}`}
        breadcrumbs={[{ label: "Workers", to: "/workers" }, { label: worker.kyc_id ?? worker.worker_code ?? worker.full_name }]}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/workers"><ArrowLeft className="size-4" /> Back</Link></Button>
            <WorkerQrButton worker={worker} />
            <Button asChild variant="outline"><Link to="/advances/new" search={{ workerId: worker.id } as any}><HandCoins className="size-4" /> New advance</Link></Button>
            {worker.status !== "blacklisted" ? (
              <Button asChild variant="destructive"><Link to="/blacklist/new" search={{ workerId: worker.id } as any}><Ban className="size-4" /> Blacklist</Link></Button>
            ) : (
              <Button variant="outline" onClick={() => setStatus.mutate("active")}>Reactivate</Button>
            )}
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-6">
          <div className="grid gap-6 md:grid-cols-[auto_1fr_auto] items-start">
            <Avatar className="size-20 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {initials(worker.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {worker.kyc_id && <Badge className="font-mono">{worker.kyc_id}</Badge>}
                {worker.worker_code && <Badge variant="outline" className="font-mono">{worker.worker_code}</Badge>}
                <StatusPill status={worker.status} tone={toneFor(worker.status) as any} />
                {worker.employment_type && <Badge variant="secondary" className="capitalize">{worker.employment_type.replace("_", " ")}</Badge>}
              </div>
              <div className="grid gap-1 sm:grid-cols-2 text-sm">
                <Info icon={Phone} label={worker.phone ?? "—"} />
                <Info icon={Mail} label={worker.email ?? "—"} />
                <Info icon={Calendar} label={`Joined ${fmtDate(worker.date_of_joining)}`} />
                <Info icon={MapPin} label={[worker.city, worker.state].filter(Boolean).join(", ") || "—"} />
              </div>
            </div>
            <div className="hidden md:flex flex-col items-center gap-1 rounded-md border p-2">
              <QRCodeSVG value={workerProfileUrl(worker.id)} size={96} />
              <span className="text-[10px] text-muted-foreground">Scan for profile</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal & KYC</TabsTrigger>
          <TabsTrigger value="bank">Bank</TabsTrigger>
          <TabsTrigger value="nominee">Nominee & Emergency</TabsTrigger>
          <TabsTrigger value="advances">Advances ({advs.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="blacklist">Blacklist ({blk.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card><CardContent className="p-6 grid gap-4 md:grid-cols-2">
            <Row k="KYC ID" v={worker.kyc_id} />
            <Row k="Full name" v={worker.full_name} />
            <Row k="Father's name" v={worker.father_name} />
            <Row k="Date of birth" v={fmtDate(worker.dob)} />
            <Row k="Gender" v={worker.gender} />
            <Row k="Aadhaar" v={maskAadhaar(worker.aadhaar_number)} />
            <Row k="PAN" v={worker.pan_number} />
            <Row k="Address" v={worker.address} />
            <Row k="Pincode" v={worker.pincode} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="nominee">
          <Card><CardContent className="p-6 grid gap-4 md:grid-cols-2">
            <Row k="Nominee name" v={worker.nominee_name} />
            <Row k="Relation" v={worker.nominee_relation} />
            <Row k="Nominee phone" v={worker.nominee_phone} />
            <Row k="Nominee DOB" v={fmtDate(worker.nominee_dob)} />
            <Row k="Nominee Aadhaar" v={maskAadhaar(worker.nominee_aadhaar)} />
            <Separator className="md:col-span-2 my-2" />
            <Row k="Emergency contact" v={worker.emergency_contact_name} />
            <Row k="Emergency phone" v={worker.emergency_contact_phone} />
            <Row k="Emergency relation" v={worker.emergency_relation} />
          </CardContent></Card>
        </TabsContent>


        <TabsContent value="bank">
          <Card><CardContent className="p-6 grid gap-4 md:grid-cols-2">
            <Row k="Bank" v={worker.bank_name} />
            <Row k="Account no." v={worker.account_number} />
            <Row k="IFSC" v={worker.ifsc} />
            <Row k="UPI" v={worker.upi_id} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="advances">
          <Card>
            <CardHeader><CardTitle className="text-base">Advance history</CardTitle></CardHeader>
            <CardContent>
              {(advs.data ?? []).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No advances yet.</div>
              ) : (
                <div className="divide-y">
                  {(advs.data ?? []).map((a: any) => (
                    <Link key={a.id} to="/advances/$id" params={{ id: a.id }} className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded">
                      <div>
                        <div className="text-sm font-mono">{a.advance_code}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(a.request_date)} · {a.reason ?? "—"}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="font-semibold tabular-nums">{inr(a.amount)}</div>
                        <StatusPill status={a.status} tone={a.status === "approved" || a.status === "disbursed" || a.status === "repaid" ? "success" : a.status === "rejected" ? "danger" : "warning"} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blacklist">
          <Card>
            <CardContent className="p-6">
              {(blk.data ?? []).length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No blacklist history.</div>
              ) : (
                <div className="divide-y">
                  {(blk.data ?? []).map((b: any) => (
                    <div key={b.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <Badge variant={b.active ? "destructive" : "outline"} className="capitalize">{b.category}</Badge>
                        <span className="text-xs text-muted-foreground">{fmtDate(b.added_at)}</span>
                      </div>
                      <p className="mt-1 text-sm">{b.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ k, v }: { k: string; v?: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-sm font-medium">{v || "—"}</div>
    </div>
  );
}

function Info({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground min-w-0">
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function workerProfileUrl(id: string) {
  if (typeof window === "undefined") return `/workers/${id}`;
  return `${window.location.origin}/workers/${id}`;
}

function WorkerQrButton({ worker }: { worker: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const url = workerProfileUrl(worker.id);
  const download = () => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${worker.kyc_id ?? worker.worker_code ?? worker.id}-qr.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline"><QrCode className="size-4" /> QR</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Worker QR code</DialogTitle>
        </DialogHeader>
        <div ref={ref} className="grid place-items-center p-4 bg-white rounded-md">
          <QRCodeSVG value={url} size={220} includeMargin />
        </div>
        <div className="space-y-1 text-center">
          <div className="font-mono text-sm">{worker.kyc_id ?? worker.worker_code}</div>
          <div className="text-sm font-medium">{worker.full_name}</div>
          <div className="text-xs text-muted-foreground break-all">{url}</div>
        </div>
        <Button onClick={download} variant="outline" className="w-full"><Download className="size-4" /> Download SVG</Button>
      </DialogContent>
    </Dialog>
  );
}

