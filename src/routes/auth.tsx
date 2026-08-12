import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/app/Logo";

import { REMEMBER_KEY } from "@/hooks/use-auth";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: AuthPage,
});

async function ensureActive(userId: string) {
  const { data } = await supabase.from("profiles").select("is_active").eq("id", userId).maybeSingle();
  if (data && data.is_active === false) {
    await supabase.auth.signOut();
    throw new Error("This account has been deactivated. Please contact your administrator.");
  }
  await supabase.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", userId);
}

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/dashboard" });
    });
  }, [navigate, redirect]);

  // If "Remember me" is unchecked, sign the user out on tab close.
  useEffect(() => {
    const handler = () => {
      try {
        if (localStorage.getItem(REMEMBER_KEY) === "0") supabase.auth.signOut();
      } catch {}
    };
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, []);

  const persistRemember = (val: boolean) => {
    try { localStorage.setItem(REMEMBER_KEY, val ? "1" : "0"); } catch {}
  };

  const doSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await ensureActive(data.user.id);
      persistRemember(remember);
      toast.success("Welcome back");
      navigate({ to: redirect ?? "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const doSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can sign in now.");
    setTab("signin");
  };

  const doGoogle = async () => {
    setLoading(true);
    persistRemember(remember);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) { setLoading(false); return toast.error(res.error.message); }
    if (res.redirected) return;
    navigate({ to: redirect ?? "/dashboard" });
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary via-primary-hover to-[oklch(0.35_0.20_27)] text-primary-foreground">
        <div className="flex items-center gap-3">
          <Logo size={48} />
          <div>
            <div className="font-display text-lg font-bold tracking-tight">
              Ashish<span className="opacity-80">Interbuild</span>
            </div>
            <div className="text-xs opacity-80">Workforce Suite</div>
          </div>
        </div>

        <div className="space-y-4 max-w-md">
          <h1 className="font-display text-4xl font-bold leading-tight">Worker KYC & Advance Management</h1>
          <p className="text-primary-foreground/80 leading-relaxed">
            A single source of truth for worker identity, kharchi advances, and blacklist governance —
            built for compliance, speed and scale.
          </p>
        </div>
        <p className="text-xs opacity-70">© {new Date().getFullYear()} AIPL. All rights reserved.</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2 lg:hidden">
              <Logo size={44} />
              <div className="font-display text-lg font-bold tracking-tight">
                Ashish<span className="text-primary">Interbuild</span>
              </div>
            </div>
            <CardTitle className="font-display text-2xl">Sign in</CardTitle>
            <CardDescription>Access the Worker KYC & Advance workspace.</CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="pt-4">
                <form onSubmit={doSignIn} className="space-y-3">
                  <div>
                    <Label htmlFor="e1">Email</Label>
                    <Input id="e1" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="p1">Password</Label>
                      <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                    </div>
                    <Input id="p1" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                    <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                      Keep me signed in on this device
                    </Label>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Sign in
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="pt-4">
                <form onSubmit={doSignUp} className="space-y-3">
                  <div><Label htmlFor="n2">Full name</Label><Input id="n2" required value={fullName} onChange={e=>setFullName(e.target.value)} /></div>
                  <div><Label htmlFor="e2">Email</Label><Input id="e2" type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
                  <div><Label htmlFor="p2">Password</Label><Input id="p2" type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} /></div>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Create account
                  </Button>
                  <p className="text-xs text-muted-foreground">First user becomes Super Admin automatically.</p>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3">
              <Separator className="flex-1" /><span className="text-xs text-muted-foreground">OR</span><Separator className="flex-1" />
            </div>
            <Button variant="outline" className="w-full" onClick={doGoogle} disabled={loading}>
              <svg className="mr-2 size-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.75-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.3 12 2.3 6.9 2.3 2.7 6.5 2.7 12S6.9 21.7 12 21.7c6.9 0 9.5-4.85 9.5-8.75 0-.6-.05-1.05-.15-1.5H12z"/></svg>
              Continue with Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
