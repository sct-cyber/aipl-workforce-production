import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Save, Loader2, User, IdCard, MapPin, Landmark,
  Users, PhoneCall, FileUp, CheckCircle2, RotateCcw, CloudUpload, X,
} from "lucide-react";
import { checkAadhaarBlacklist, type BlacklistHit } from "@/lib/blacklist";
import { BlacklistWarning } from "@/components/app/BlacklistWarning";
import { StateCombobox } from "@/components/app/StateCombobox";

export const Route = createFileRoute("/_authenticated/workers/new")({
  component: NewWorker,
});

const DOC_TYPES = [
  { key: "aadhaar", label: "Aadhaar" },
  { key: "pan", label: "PAN" },
  { key: "bank_passbook", label: "Bank passbook / cheque" },
  { key: "photo", label: "Photograph" },
  { key: "other", label: "Other" },
] as const;
type DocKey = typeof DOC_TYPES[number]["key"];

const schema = z.object({
  // Step 1 — Personal (all mandatory except alt/email)
  full_name: z.string().trim().min(2, "Full name is required").max(100),
  father_name: z.string().trim().max(100).optional().or(z.literal("")),
  dob: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"], { required_error: "Gender is required" }),
  phone: z.string().regex(/^\d{10}$/, "10-digit mobile number required"),
  uan_number: z.string().regex(/^\d{12}$/, "UAN must be exactly 12 digits"),
  alt_phone: z.string().regex(/^\d{10}$/, "10-digit phone").optional().or(z.literal("")),
  email: z.string().email().max(255).optional().or(z.literal("")),
  // Step 2 — Identity + employment
  aadhaar_number: z.string().regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits"),
  pan_number: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format (e.g. ABCDE1234F)"),
  project_id: z.string().uuid().optional().or(z.literal("")),
  trade_id: z.string().uuid().optional().or(z.literal("")),
  designation_id: z.string().uuid().optional().or(z.literal("")),
  date_of_joining: z.string().optional().or(z.literal("")),
  employment_type: z.enum(["permanent", "contract", "daily_wage", "temporary"]).optional(),
  // Step 3 — Address
  address: z.string().trim().min(3, "Address is required").max(500),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().min(2, "State is required").max(100),
  pincode: z.string().regex(/^\d{6}$/, "6-digit pincode required"),
  // Step 4 — Bank
  bank_name: z.string().trim().min(2, "Bank name is required").max(100),
  account_number: z.string().regex(/^\d{9,18}$/, "Account number must be 9-18 digits"),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC (e.g. HDFC0001234)"),
  upi_id: z.string().max(100).optional().or(z.literal("")),
  // Step 5 — Nominee (optional)
  nominee_name: z.string().max(100).optional().or(z.literal("")),
  nominee_relation: z.string().max(50).optional().or(z.literal("")),
  nominee_phone: z.string().regex(/^\d{10}$/, "10-digit phone").optional().or(z.literal("")),
  nominee_dob: z.string().optional().or(z.literal("")),
  nominee_aadhaar: z.string().regex(/^\d{12}$/, "12-digit Aadhaar").optional().or(z.literal("")),
  // Step 6 — Emergency
  emergency_contact_name: z.string().trim().min(2, "Contact name is required").max(100),
  emergency_contact_phone: z.string().regex(/^\d{10}$/, "10-digit contact number required"),
  emergency_relation: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});
type FormT = z.infer<typeof schema>;

const steps = [
  { key: "personal", label: "Personal", icon: User, desc: "Basic identity information." },
  { key: "identity", label: "Identity", icon: IdCard, desc: "Government IDs, project & role." },
  { key: "address", label: "Address", icon: MapPin, desc: "Residence details." },
  { key: "bank", label: "Bank", icon: Landmark, desc: "Salary account details." },
  { key: "nominee", label: "Nominee", icon: Users, desc: "Nominee for statutory benefits." },
  { key: "emergency", label: "Emergency", icon: PhoneCall, desc: "Whom to contact in emergencies." },
  { key: "documents", label: "Documents", icon: FileUp, desc: "Upload KYC documents." },
  { key: "review", label: "Review", icon: CheckCircle2, desc: "Verify and submit." },
];

const STEP_FIELDS: (keyof FormT)[][] = [
  ["full_name", "father_name", "dob", "gender", "phone", "uan_number", "alt_phone", "email"],
  ["aadhaar_number", "pan_number", "project_id", "trade_id", "designation_id", "date_of_joining", "employment_type"],
  ["address", "city", "state", "pincode"],
  ["bank_name", "account_number", "ifsc", "upi_id"],
  ["nominee_name", "nominee_relation", "nominee_phone", "nominee_dob", "nominee_aadhaar"],
  ["emergency_contact_name", "emergency_contact_phone", "emergency_relation", "notes"],
  [],
  [],
];

const REQUIRED_DOCS: DocKey[] = ["aadhaar", "pan", "bank_passbook"];

const DEFAULTS: FormT = {
  full_name: "", father_name: "", dob: "", gender: undefined as any, phone: "", uan_number: "", alt_phone: "", email: "",
  aadhaar_number: "", pan_number: "", project_id: "", trade_id: "", designation_id: "",
  date_of_joining: "", employment_type: "permanent",
  address: "", city: "", state: "", pincode: "",
  bank_name: "", account_number: "", ifsc: "", upi_id: "",
  nominee_name: "", nominee_relation: "", nominee_phone: "", nominee_dob: "", nominee_aadhaar: "",
  emergency_contact_name: "", emergency_contact_phone: "", emergency_relation: "", notes: "",
};

function NewWorker() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [blacklistHit, setBlacklistHit] = useState<BlacklistHit | null>(null);
  const [blacklistOverride, setBlacklistOverride] = useState<string | null>(null);
  const [checkingBlk, setCheckingBlk] = useState(false);

  const runAadhaarCheck = async (raw: string) => {
    const aadhaar = raw.replace(/\D/g, "");
    if (aadhaar.length !== 12) return;
    if (blacklistOverride) return; // already overridden this session
    setCheckingBlk(true);
    try {
      const hit = await checkAadhaarBlacklist(aadhaar);
      if (hit) setBlacklistHit(hit);
    } finally {
      setCheckingBlk(false);
    }
  };
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const skipNextSave = useRef(true);

  const form = useForm<FormT>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  // Load draft on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("worker_drafts")
        .select("*")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setDraftId(data.id);
        form.reset({ ...DEFAULTS, ...(data.payload as any) });
        setStep(Math.min(Math.max(data.step ?? 0, 0), steps.length - 1));
        setSavedAt(new Date(data.updated_at));
        toast.info("Draft resumed", { description: "Continuing from where you left off." });
      }
      setHydrated(true);
    })();
     
  }, [user?.id]);

  // Auto-save draft (debounced) — never lose data
  const watched = form.watch();
  useEffect(() => {
    if (!user || !hydrated) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const t = setTimeout(async () => {
      setSavingDraft(true);
      const payload: any = { ...watched };
      const row = { owner_id: user.id, step, payload, updated_at: new Date().toISOString() };
      if (draftId) {
        await supabase.from("worker_drafts").update(row).eq("id", draftId);
      } else {
        const { data } = await supabase.from("worker_drafts").insert(row).select("id").single();
        if (data) setDraftId(data.id);
      }
      setSavedAt(new Date());
      setSavingDraft(false);
    }, 1200);
    return () => clearTimeout(t);
     
  }, [JSON.stringify(watched), step, hydrated]);

  const projectsQ = useQuery({
    queryKey: ["projects-active"],
    queryFn: async () => (await supabase.from("projects").select("id, name, code").eq("status", "active").is("deleted_at", null).order("name")).data ?? [],
  });
  const tradesQ = useQuery({
    queryKey: ["trades-active"],
    queryFn: async () => (await supabase.from("trades").select("id, name").eq("active", true).is("deleted_at", null).order("name")).data ?? [],
  });
  const selectedTrade = form.watch("trade_id");
  const designationsQ = useQuery({
    queryKey: ["designations-active", selectedTrade],
    queryFn: async () => {
      let q = supabase.from("designations").select("id, name, trade_id").eq("active", true).is("deleted_at", null).order("name");
      if (selectedTrade) q = q.eq("trade_id", selectedTrade);
      return (await q).data ?? [];
    },
  });

  const missingDocs = REQUIRED_DOCS.filter(k => !files[k]);
  const save = useMutation({
    mutationFn: async (v: FormT) => {
      if (missingDocs.length) {
        throw new Error(`Missing required documents: ${missingDocs.map(k => DOC_TYPES.find(d => d.key === k)?.label ?? k).join(", ")}`);
      }
      const payload: any = { ...v, created_by: user?.id };
      Object.keys(payload).forEach(k => payload[k] === "" && (payload[k] = null));
      const { data, error } = await supabase.from("workers").insert(payload).select().single();
      if (error) throw error;
      // Upload documents
      for (const doc of DOC_TYPES) {
        const file = files[doc.key];
        if (!file) continue;
        const path = `${data.id}/${doc.key}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from("worker-documents").upload(path, file);
        if (up.error) continue;
        await supabase.from("worker_documents").insert({
          worker_id: data.id,
          doc_type: doc.key as any,
          file_url: path,
          file_name: file.name,
          uploaded_by: user?.id,
        } as any);
      }
      // Clear draft
      if (draftId) await supabase.from("worker_drafts").delete().eq("id", draftId);
      return data;
    },
    onSuccess: (w: any) => {
      toast.success(`Worker created — ${w.worker_code} · ${w.kyc_id}`);
      navigate({ to: "/workers/$id", params: { id: w.id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const next = async () => {
    const fields = STEP_FIELDS[step];
    const ok = fields.length ? await form.trigger(fields as any) : true;
    if (ok) setStep(s => Math.min(s + 1, steps.length - 1));
    else toast.error("Please fix the highlighted fields.");
  };

  const resetForm = async () => {
    if (!confirm("Reset the whole form and delete the saved draft?")) return;
    form.reset(DEFAULTS);
    setFiles({});
    setStep(0);
    if (draftId && user) {
      await supabase.from("worker_drafts").delete().eq("id", draftId);
      setDraftId(null);
    }
    setSavedAt(null);
    skipNextSave.current = true;
    toast.success("Form reset.");
  };

  const StepIcon = steps[step].icon;

  return (
    <>
      <PageHeader
        title="New Worker KYC"
        description="Register a new worker with full KYC details."
        breadcrumbs={[{ label: "Workers", to: "/workers" }, { label: "New" }]}
        actions={
          <Button type="button" variant="outline" onClick={resetForm}>
            <RotateCcw className="size-4" /> Reset form
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary shrink-0">
                <StepIcon className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase text-muted-foreground tracking-wide">Step {step + 1} of {steps.length}</div>
                <div className="font-semibold truncate">{steps[step].label}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {savingDraft ? (
                <><Loader2 className="size-3 animate-spin" /> Saving draft…</>
              ) : savedAt ? (
                <><CloudUpload className="size-3" /> Draft saved {savedAt.toLocaleTimeString()}</>
              ) : (
                <>Auto-save on</>
              )}
            </div>
          </div>
          <div className="hidden sm:flex gap-1 mb-2">
            {steps.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => i <= step && setStep(i)}
                title={s.label}
                className={`h-1.5 flex-1 rounded-full transition ${i <= step ? "bg-primary" : "bg-muted"} ${i <= step ? "cursor-pointer" : "cursor-not-allowed"}`}
              />
            ))}
          </div>
          <Progress value={((step + 1) / steps.length) * 100} className="h-1" />
        </CardContent>
      </Card>

      <form onSubmit={form.handleSubmit(v => save.mutate(v))}>
        <Card>
          <CardHeader>
            <CardTitle>{steps[step].label}</CardTitle>
            <CardDescription>{steps[step].desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full name *" err={form.formState.errors.full_name?.message}><Input {...form.register("full_name")} /></Field>
                <Field label="Father's name"><Input {...form.register("father_name")} /></Field>
                <Field label="Date of birth *" err={form.formState.errors.dob?.message}><Input type="date" {...form.register("dob")} /></Field>
                <Field label="Gender *" err={form.formState.errors.gender?.message as any}>
                  <Select value={form.watch("gender") ?? ""} onValueChange={(v) => form.setValue("gender", v as any, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Mobile number * (10 digit)" err={form.formState.errors.phone?.message}>
                  <Input inputMode="numeric" maxLength={10}
                    {...form.register("phone")}
                    onChange={e => form.setValue("phone", e.target.value.replace(/\D/g, "").slice(0, 10), { shouldValidate: true })}
                  />
                </Field>
                <Field label="UAN number * (12 digit)" err={form.formState.errors.uan_number?.message}>
                  <Input inputMode="numeric" maxLength={12}
                    {...form.register("uan_number")}
                    onChange={e => form.setValue("uan_number", e.target.value.replace(/\D/g, "").slice(0, 12), { shouldValidate: true })}
                  />
                </Field>
                <Field label="Alt phone" err={form.formState.errors.alt_phone?.message}><Input {...form.register("alt_phone")} /></Field>
                <Field label="Email" err={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
              </div>
            )}
            {step === 1 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Aadhaar * (12 digit)" err={form.formState.errors.aadhaar_number?.message}>
                  <div className="relative">
                    <Input
                      {...form.register("aadhaar_number")}
                      inputMode="numeric"
                      maxLength={12}
                      onBlur={(e) => runAadhaarCheck(e.target.value)}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 12);
                        form.setValue("aadhaar_number", v, { shouldValidate: true });
                        if (v.length === 12) runAadhaarCheck(v);
                      }}
                    />
                    {checkingBlk && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />}
                    {blacklistOverride && (
                      <div className="mt-1 text-[11px] text-amber-700">Blacklist override active — audited.</div>
                    )}
                  </div>
                </Field>
                <Field label="PAN *" err={form.formState.errors.pan_number?.message}><Input maxLength={10} {...form.register("pan_number")} onChange={(e) => form.setValue("pan_number", e.target.value.toUpperCase().slice(0, 10), { shouldValidate: true })} /></Field>
                <Field label="Project">
                  <Select value={form.watch("project_id") ?? ""} onValueChange={(v) => form.setValue("project_id", v as any)}>
                    <SelectTrigger><SelectValue placeholder={projectsQ.data?.length ? "Select project" : "No active projects"} /></SelectTrigger>
                    <SelectContent>
                      {projectsQ.data?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Trade">
                  <Select value={form.watch("trade_id") ?? ""} onValueChange={(v) => { form.setValue("trade_id", v as any); form.setValue("designation_id", ""); }}>
                    <SelectTrigger><SelectValue placeholder={tradesQ.data?.length ? "Select trade" : "No trades"} /></SelectTrigger>
                    <SelectContent>
                      {tradesQ.data?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Designation">
                  <Select value={form.watch("designation_id") ?? ""} onValueChange={(v) => form.setValue("designation_id", v as any)}>
                    <SelectTrigger><SelectValue placeholder={designationsQ.data?.length ? "Select designation" : "Select trade first"} /></SelectTrigger>
                    <SelectContent>
                      {designationsQ.data?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date of joining"><Input type="date" {...form.register("date_of_joining")} /></Field>
                <Field label="Employment type">
                  <Select value={form.watch("employment_type") ?? ""} onValueChange={(v) => form.setValue("employment_type", v as any)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="daily_wage">Daily Wage</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><Field label="Address *" err={form.formState.errors.address?.message}><Textarea rows={2} {...form.register("address")} /></Field></div>
                <Field label="City *" err={form.formState.errors.city?.message}><Input {...form.register("city")} /></Field>
                <Field label="State *" err={form.formState.errors.state?.message}>
                  <StateCombobox
                    value={form.watch("state") ?? ""}
                    onChange={(v) => form.setValue("state", v, { shouldValidate: true })}
                    invalid={!!form.formState.errors.state}
                  />
                </Field>
                <Field label="Pincode *" err={form.formState.errors.pincode?.message}>
                  <Input inputMode="numeric" maxLength={6} {...form.register("pincode")}
                    onChange={e => form.setValue("pincode", e.target.value.replace(/\D/g, "").slice(0, 6), { shouldValidate: true })} />
                </Field>
              </div>
            )}
            {step === 3 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Bank name *" err={form.formState.errors.bank_name?.message}><Input {...form.register("bank_name")} /></Field>
                <Field label="Account number *" err={form.formState.errors.account_number?.message}>
                  <Input inputMode="numeric" maxLength={18} {...form.register("account_number")}
                    onChange={e => form.setValue("account_number", e.target.value.replace(/\D/g, "").slice(0, 18), { shouldValidate: true })} />
                </Field>
                <Field label="IFSC *" err={form.formState.errors.ifsc?.message}><Input maxLength={11} {...form.register("ifsc")} onChange={e => form.setValue("ifsc", e.target.value.toUpperCase().slice(0, 11), { shouldValidate: true })} /></Field>
                <Field label="UPI ID"><Input {...form.register("upi_id")} placeholder="name@bank" /></Field>
              </div>
            )}
            {step === 4 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nominee name"><Input {...form.register("nominee_name")} /></Field>
                <Field label="Relation"><Input {...form.register("nominee_relation")} placeholder="e.g. Spouse" /></Field>
                <Field label="Nominee phone" err={form.formState.errors.nominee_phone?.message}><Input {...form.register("nominee_phone")} /></Field>
                <Field label="Nominee DOB"><Input type="date" {...form.register("nominee_dob")} /></Field>
                <Field label="Nominee Aadhaar" err={form.formState.errors.nominee_aadhaar?.message}><Input {...form.register("nominee_aadhaar")} /></Field>
              </div>
            )}
            {step === 5 && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Contact name *" err={form.formState.errors.emergency_contact_name?.message}><Input {...form.register("emergency_contact_name")} /></Field>
                <Field label="Contact phone * (10 digit)" err={form.formState.errors.emergency_contact_phone?.message}>
                  <Input inputMode="numeric" maxLength={10} {...form.register("emergency_contact_phone")}
                    onChange={e => form.setValue("emergency_contact_phone", e.target.value.replace(/\D/g, "").slice(0, 10), { shouldValidate: true })} />
                </Field>
                <Field label="Relation"><Input {...form.register("emergency_relation")} placeholder="e.g. Father" /></Field>
                <div className="md:col-span-2"><Field label="Notes"><Textarea rows={3} {...form.register("notes")} /></Field></div>
              </div>
            )}
            {step === 6 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Attach KYC documents. Uploads happen when you submit the form. Fields marked <span className="text-destructive font-semibold">*</span> are mandatory.
                </p>
                {missingDocs.length > 0 && (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    Missing required documents: {missingDocs.map(k => DOC_TYPES.find(d => d.key === k)?.label ?? k).join(", ")}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {DOC_TYPES.map(d => {
                    const required = (REQUIRED_DOCS as string[]).includes(d.key);
                    const missing = required && !files[d.key];
                    return (
                    <div key={d.key} className={`rounded-md border p-3 flex items-center justify-between gap-3 ${missing ? "border-destructive/60" : ""}`}>
                      <div className="min-w-0">
                        <div className="font-medium text-sm flex items-center gap-1">
                          {d.label}{required && <span className="text-destructive">*</span>}
                          {files[d.key] && <CheckCircle2 className="size-3.5 text-green-600" />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {files[d.key]?.name ?? (required ? "Required — no file selected" : "No file selected")}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {files[d.key] && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => setFiles(f => { const n = { ...f }; delete n[d.key]; return n; })}><X className="size-4" /></Button>
                        )}
                        <label className="inline-flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-muted">
                          <FileUp className="size-3.5" />
                          {files[d.key] ? "Replace" : "Upload"}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              if (f.size > 10 * 1024 * 1024) return toast.error("Max 10MB per file");
                              setFiles(fs => ({ ...fs, [d.key]: f }));
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            )}
            {step === 7 && (
              <ReviewGrid values={form.getValues()} files={files} />
            )}
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="size-4" /> Previous
          </Button>
          {step < steps.length - 1 ? (
            <Button type="button" onClick={next}>Next <ArrowRight className="size-4" /></Button>
          ) : (
            <Button type="submit" disabled={save.isPending || missingDocs.length > 0} title={missingDocs.length ? "Upload required documents first" : undefined}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Submit KYC
            </Button>
          )}
        </div>
      </form>

      {blacklistHit && (
        <BlacklistWarning
          hit={blacklistHit}
          onClose={() => setBlacklistHit(null)}
          onOverride={(reason) => setBlacklistOverride(reason)}
        />
      )}
    </>
  );
}

function Field({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

function ReviewGrid({ values, files }: { values: FormT; files: Partial<Record<DocKey, File>> }) {
  const rows = Object.entries(values).filter(([, v]) => v);
  const attached = DOC_TYPES.filter(d => files[d.key]);
  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b py-1.5 text-sm">
            <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
            <span className="font-medium truncate">{String(v)}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Documents</div>
        {attached.length ? (
          <div className="flex flex-wrap gap-2">
            {attached.map(d => <Badge key={d.key} variant="secondary">{d.label} · {files[d.key]!.name}</Badge>)}
          </div>
        ) : <div className="text-sm text-muted-foreground">No documents attached.</div>}
      </div>
    </div>
  );
}
