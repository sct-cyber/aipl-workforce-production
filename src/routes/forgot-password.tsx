import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Password reset email sent");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Forgot password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a secure link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-4 flex gap-3">
                <MailCheck className="size-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  If an account exists for <b>{email}</b>, a reset link has been sent.
                  Check your inbox and spam folder.
                </div>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth"><ArrowLeft className="size-4 mr-2" /> Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Send reset link
              </Button>
              <Link to="/auth" className="block text-center text-xs text-muted-foreground hover:underline pt-2">
                Back to sign in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
