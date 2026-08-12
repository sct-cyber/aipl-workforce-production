import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash automatically.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasRecoverySession(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasRecoverySession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { data, error } = await supabase.auth.updateUser({ password: pw });
    if (!error && data.user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", data.user.id);
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in again.");
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary mb-2">
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="font-display text-2xl">Set a new password</CardTitle>
          <CardDescription>Choose a strong password of at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasRecoverySession ? (
            <div className="text-sm text-muted-foreground">
              Waiting for password recovery session… If nothing happens, request a new reset link from
              the sign-in page.
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cpw">Confirm password</Label>
                <Input id="cpw" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
