import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRoles, ROLE_LABELS } from "@/hooks/use-role";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { useTheme } from "@/components/app/ThemeProvider";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Camera, Trash2, KeyRound, Loader2, Sun, Moon, Monitor, Briefcase } from "lucide-react";
import { initials } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
});

const passwordSchema = z.object({
  password: z.string().min(8, "At least 8 characters").max(128),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

function ProfilePage() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const { roles, primaryLabel } = useRoles();
  const { theme, toggle } = useTheme();
  const avatarUrl = useAvatarUrl(profile?.avatar_url);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  // Sync form when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile?.id]);

  const projectsQ = useQuery({
    queryKey: ["my-projects", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_projects")
        .select("project:projects(id, name, code, status)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.project).filter(Boolean);
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const parsed = profileSchema.parse({ full_name: fullName, phone });
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: parsed.full_name, phone: parsed.phone || null })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to update profile"),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      if (!ALLOWED.includes(file.type)) throw new Error("Use PNG, JPEG, or WebP");
      if (file.size > MAX_AVATAR_BYTES) throw new Error("Image must be under 5MB");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${user!.id}/avatar-${Date.now()}.${ext}`;

      // Best-effort remove old file if it looked like a storage path (not a URL)
      const prev = profile?.avatar_url;
      if (prev && !/^https?:\/\//i.test(prev)) {
        await supabase.storage.from("avatars").remove([prev]);
      }

      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("profiles").update({ avatar_url: path }).eq("id", user!.id);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      toast.success("Profile photo updated");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["avatar-url"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Upload failed"),
  });

  const deleteAvatar = useMutation({
    mutationFn: async () => {
      const prev = profile?.avatar_url;
      if (prev && !/^https?:\/\//i.test(prev)) {
        await supabase.storage.from("avatars").remove([prev]);
      }
      const { error } = await supabase
        .from("profiles").update({ avatar_url: null }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile photo removed");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      qc.invalidateQueries({ queryKey: ["avatar-url"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove photo"),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      const parsed = passwordSchema.parse({ password: pw, confirm: pw2 });
      const { error } = await supabase.auth.updateUser({ password: parsed.password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password changed");
      setPw(""); setPw2("");
    },
    onError: (e: any) => {
      const msg = e?.errors?.[0]?.message ?? e?.message ?? "Failed to change password";
      toast.error(msg);
    },
  });

  const nameForInitials = profile?.full_name || user?.user_metadata?.full_name || user?.email;

  return (
    <>
      <PageHeader title="My Profile" description="Manage your personal information, photo, password, and appearance." />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Photo + identity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Profile photo</CardTitle>
            <CardDescription>PNG, JPEG, or WebP. Up to 5MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="size-28 ring-2 ring-border">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={nameForInitials ?? ""} />}
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {initials(nameForInitials)}
              </AvatarFallback>
            </Avatar>

            <div className="text-center">
              <div className="font-semibold">{profile?.full_name || user?.email?.split("@")[0]}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
              <Badge variant="secondary" className="mt-2">{primaryLabel}</Badge>
            </div>

            <input
              ref={fileRef} type="file" accept={ALLOWED.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar.mutate(f);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap justify-center gap-2 w-full">
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploadAvatar.isPending}
                size="sm"
              >
                {uploadAvatar.isPending
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Camera className="size-4" />}
                {profile?.avatar_url ? "Change photo" : "Upload photo"}
              </Button>
              {profile?.avatar_url && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => deleteAvatar.mutate()}
                  disabled={deleteAvatar.isPending}
                >
                  <Trash2 className="size-4" /> Remove
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
            <CardDescription>Your name and contact details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name" value={fullName} maxLength={120}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="phone">Mobile number</Label>
                <Input
                  id="phone" value={phone} maxLength={20}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user?.email ?? ""} readOnly className="mt-1.5 bg-muted" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Contact an administrator to change your email.
                </p>
              </div>
              <div>
                <Label>Role</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {roles.length === 0 && <Badge variant="outline">Viewer</Badge>}
                  {roles.map((r) => (
                    <Badge key={r} variant="secondary">{ROLE_LABELS[r]}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                {saveProfile.isPending && <Loader2 className="size-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assigned projects */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Briefcase className="size-5" /> Assigned projects</CardTitle>
            <CardDescription>Projects you have access to. Managed by administrators.</CardDescription>
          </CardHeader>
          <CardContent>
            {projectsQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (projectsQ.data ?? []).length === 0 ? (
              <Alert>
                <AlertDescription>You are not assigned to any projects yet.</AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(projectsQ.data ?? []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{p.code}</div>
                    </div>
                    <Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">
                      {p.status ?? "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Theme preference is saved to this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-muted">
                  {theme === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
                </div>
                <div>
                  <div className="text-sm font-semibold capitalize">{theme} theme</div>
                  <div className="text-xs text-muted-foreground">Click to switch appearance.</div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggle}>
                <Monitor className="size-4" /> Switch to {theme === "dark" ? "light" : "dark"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-5" /> Change password</CardTitle>
            <CardDescription>Use at least 8 characters. You will remain signed in on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pw">New password</Label>
                  <Input
                    id="pw" type="password" value={pw} minLength={8} maxLength={128}
                    onChange={(e) => setPw(e.target.value)} className="mt-1.5" autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="pw2">Confirm password</Label>
                  <Input
                    id="pw2" type="password" value={pw2} minLength={8} maxLength={128}
                    onChange={(e) => setPw2(e.target.value)} className="mt-1.5" autoComplete="new-password"
                  />
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button type="submit" disabled={changePassword.isPending || !pw || !pw2}>
                  {changePassword.isPending && <Loader2 className="size-4 animate-spin" />}
                  Update password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
