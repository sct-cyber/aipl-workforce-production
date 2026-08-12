import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, Loader2, Download, Printer, Mail, Eye, ShieldAlert, Sparkles, Search,
} from "lucide-react";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";
import {
  buildPdf, extractVars, renderTemplate, uploadDocument, getSignedDocUrl, type Vars,
} from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/documents/")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const { isStaff } = useRoles();
  if (!isStaff) {
    return (
      <>
        <PageHeader title="Documents" description="Generate branded PDFs from templates." />
        <Alert><ShieldAlert className="size-4" /><AlertDescription>Staff access required.</AlertDescription></Alert>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Documents" description="Generate branded PDFs from templates — KYC, ID card, warnings, certificates." />
      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate"><Sparkles className="size-4" /> Generate</TabsTrigger>
          <TabsTrigger value="history"><FileText className="size-4" /> History</TabsTrigger>
        </TabsList>
        <TabsContent value="generate" className="mt-4"><GenerateTab /></TabsContent>
        <TabsContent value="history" className="mt-4"><HistoryTab /></TabsContent>
      </Tabs>
    </>
  );
}

/* ------------------------------ Generate ------------------------------ */

function GenerateTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [templateId, setTemplateId] = useState<string>("");
  const [workerId, setWorkerId] = useState<string>("");
  const [vars, setVars] = useState<Vars>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [savedRow, setSavedRow] = useState<any>(null);

  const templates = useQuery({
    queryKey: ["doc-templates-active"],
    queryFn: async () =>
      (await supabase.from("document_templates")
        .select("*").eq("active", true).is("deleted_at", null).order("name")).data ?? [],
  });

  const workers = useQuery({
    queryKey: ["workers-picklist"],
    queryFn: async () =>
      (await supabase.from("workers")
        .select("id, kyc_id, full_name, father_name, dob, aadhaar_number, pan_number, phone, email, address, city, state, pincode, designation, department, date_of_joining, bank_name, account_number, ifsc, photo_url, emergency_contact_name, emergency_contact_phone, project_id, projects(name), trades(name)")
        .is("deleted_at", null).order("full_name").limit(500)).data ?? [],
  });

  const template = useMemo(
    () => templates.data?.find((t: any) => t.id === templateId),
    [templates.data, templateId],
  );
  const worker = useMemo(
    () => workers.data?.find((w: any) => w.id === workerId),
    [workers.data, workerId],
  );

  const templateVars = useMemo(
    () => (template ? extractVars(template.content) : []),
    [template],
  );

  // Autofill worker-derived vars when worker/template changes
  useEffect(() => {
    if (!template) return;
    const autofill: Vars = {
      worker_name: worker?.full_name ?? "",
      father_name: worker?.father_name ?? "",
      kyc_id: worker?.kyc_id ?? "",
      dob: worker?.dob ?? "",
      aadhaar: worker?.aadhaar_number ?? "",
      pan: worker?.pan_number ?? "",
      phone: worker?.phone ?? "",
      email: worker?.email ?? "",
      address: [worker?.address, worker?.city, worker?.state, worker?.pincode].filter(Boolean).join(", "),
      designation: worker?.designation ?? "",
      trade: (worker as any)?.trades?.name ?? "",
      department: worker?.department ?? "",
      doj: worker?.date_of_joining ?? "",
      bank_name: worker?.bank_name ?? "",
      account_number: worker?.account_number ?? "",
      ifsc: worker?.ifsc ?? "",
      blood_group: "",
      emergency_contact: [worker?.emergency_contact_name, worker?.emergency_contact_phone].filter(Boolean).join(" · "),
      project_name: (worker as any)?.projects?.name ?? "",
      issue_date: new Date().toLocaleDateString("en-IN"),
    };
    setVars((prev) => {
      const next: Vars = { ...autofill };
      // preserve user overrides for keys not in autofill
      for (const k of Object.keys(prev)) if (!(k in autofill) || !autofill[k]) next[k] = prev[k];
      return next;
    });
  }, [template, worker]);

  const generate = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("Pick a template");
      const rendered = renderTemplate(template.content, vars);
      const qrPayload = worker ? `${window.location.origin}/workers/${worker.id}` : undefined;
      const blob = await buildPdf({
        title: template.name,
        bodyText: rendered,
        photoUrl: worker?.photo_url ?? null,
        qrPayload,
        docNumber: "PENDING",
      });

      // Insert record first to get doc_number
      const entity_type = worker ? "worker" : "template";
      const entity_id = worker?.id ?? template.id;
      const { data: row, error: insErr } = await supabase
        .from("generated_documents")
        .insert({
          document_type: template.code,
          entity_type,
          entity_id,
          title: `${template.name}${worker ? ` — ${worker.full_name}` : ""}`,
          file_path: "pending",
          mime_type: "application/pdf",
          generated_by: user?.id,
          metadata: { template_id: template.id, variables: vars },
        } as any)
        .select("*")
        .single();
      if (insErr) throw insErr;

      // Rebuild PDF with real doc_number stamped
      const finalBlob = await buildPdf({
        title: template.name,
        bodyText: rendered,
        photoUrl: worker?.photo_url ?? null,
        qrPayload,
        docNumber: (row as any).doc_number,
      });

      const path = `${entity_type}/${entity_id}/${(row as any).doc_number}.pdf`;
      await uploadDocument(finalBlob, path);

      const { error: updErr } = await supabase
        .from("generated_documents")
        .update({ file_path: path, size_bytes: finalBlob.size })
        .eq("id", (row as any).id);
      if (updErr) throw updErr;

      const signed = await getSignedDocUrl(path);
      return { row, signedUrl: signed };
    },
    onSuccess: ({ row, signedUrl }) => {
      setSavedRow(row);
      setPreviewUrl(signedUrl);
      setPreviewOpen(true);
      qc.invalidateQueries({ queryKey: ["generated-documents"] });
      toast.success(`Generated ${(row as any).doc_number}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Generation failed"),
  });

  const missing = templateVars.filter((k) => !vars[k]);

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      {/* Left: pick template + worker */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Template *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Pick a template…" /></SelectTrigger>
              <SelectContent>
                {templates.data?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="font-mono text-[11px] text-muted-foreground mr-2">{t.code}</span>{t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Worker</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger><SelectValue placeholder="Optional — pick worker" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {workers.data?.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="font-mono text-[11px] text-muted-foreground mr-2">{w.kyc_id}</span>{w.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Auto-fills worker variables. Leave blank for a generic doc.</p>
          </div>

          {template && (
            <div className="rounded-md border p-3 bg-muted/30 text-xs space-y-1">
              <div className="font-medium text-foreground">{template.name}</div>
              <div className="text-muted-foreground">{template.description}</div>
              <div className="pt-1">
                <Badge variant="outline" className="capitalize">{template.category}</Badge>{" "}
                <Badge variant="secondary">{templateVars.length} variables</Badge>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!template || generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Generate PDF
          </Button>
        </CardContent>
      </Card>

      {/* Right: variables + live preview */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {!template && (
            <div className="grid place-items-center py-16 text-sm text-muted-foreground">
              Pick a template on the left to begin.
            </div>
          )}
          {template && (
            <>
              <div>
                <div className="text-sm font-semibold mb-2">Variables</div>
                {templateVars.length === 0 ? (
                  <p className="text-xs text-muted-foreground">This template has no variables.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {templateVars.map((k) => (
                      <div key={k} className="space-y-1.5">
                        <Label className="text-xs font-mono">{`{{${k}}}`}</Label>
                        <Input
                          value={(vars[k] as string) ?? ""}
                          onChange={(e) => setVars({ ...vars, [k]: e.target.value })}
                          placeholder="—"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {missing.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Missing values render as <span className="font-mono">—</span>: {missing.join(", ")}
                  </p>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Live text preview</div>
                <Textarea
                  readOnly
                  rows={12}
                  value={renderTemplate(template.content, vars)}
                  className="font-mono text-xs bg-muted/30"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* PDF preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {savedRow?.title} <span className="font-mono text-xs text-muted-foreground">· {savedRow?.doc_number}</span>
            </DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            <iframe src={previewUrl} className="w-full h-[70vh] rounded-md border bg-white" title="PDF preview" />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => previewUrl && window.open(previewUrl, "_blank")}>
                <Printer className="size-4" /> Print
              </Button>
              <Button variant="outline" onClick={() => { setEmailTo((worker as any)?.email ?? ""); setEmailOpen(true); }}>
                <Mail className="size-4" /> Email
              </Button>
              <Button asChild>
                <a href={previewUrl ?? "#"} download={`${savedRow?.doc_number ?? "document"}.pdf`}>
                  <Download className="size-4" /> Download
                </a>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email (mailto) */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Email document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Opens your mail client with a signed download link (valid for 1 hour). Attach the PDF manually if needed.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Recipient</Label>
            <Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="name@example.com" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!emailTo || !previewUrl || !savedRow) return;
                const subject = encodeURIComponent(`${savedRow.title} — ${savedRow.doc_number}`);
                const body = encodeURIComponent(
                  `Please find the document link below (valid for 1 hour):\n\n${previewUrl}\n\n— AIPL Workforce Suite`,
                );
                window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
                setEmailOpen(false);
              }}
            >
              <Mail className="size-4" /> Open mail client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ History ------------------------------ */

function HistoryTab() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["generated-documents"],
    queryFn: async () =>
      (await supabase.from("generated_documents")
        .select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list.data ?? [];
    return (list.data ?? []).filter((r: any) =>
      (r.title ?? "").toLowerCase().includes(s) ||
      (r.doc_number ?? "").toLowerCase().includes(s) ||
      (r.document_type ?? "").toLowerCase().includes(s));
  }, [list.data, q]);

  const openDoc = async (path: string) => {
    const url = await getSignedDocUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open document");
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-3 border-b flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Search doc number, title…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Badge variant="secondary" className="ml-auto">{filtered.length}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Doc #</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Generated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No documents yet.</TableCell></TableRow>
            )}
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.doc_number}</TableCell>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell><Badge variant="outline" className="font-mono text-[10px]">{r.document_type}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDateTime(r.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openDoc(r.file_path)}>
                    <Eye className="size-4" /> Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
