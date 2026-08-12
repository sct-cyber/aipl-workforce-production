import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { roles } = useRoles();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="size-5" />Organization</CardTitle>
          <CardDescription>Basic AIPL organization info.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Organization name</Label><Input defaultValue="AIPL" className="mt-1.5" /></div>
          <div><Label>Contact email</Label><Input defaultValue="hr@aipl.example" className="mt-1.5" /></div>
          <div><Label>Default currency</Label><Input defaultValue="INR (₹)" readOnly className="mt-1.5" /></div>
          <Button>Save changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><span className="text-muted-foreground">Email:</span> <span className="font-mono">{user?.email}</span></div>
          <div><span className="text-muted-foreground">Role(s):</span> {roles.length ? roles.join(", ") : "—"}</div>
          <div><span className="text-muted-foreground">User ID:</span> <span className="font-mono text-xs">{user?.id}</span></div>
        </CardContent>
      </Card>

      <Alert className="md:col-span-2">
        <Info className="size-4" />
        <AlertDescription>
          Roles: <b>Super Admin</b> and <b>Admin</b> have full access including user management.
          <b> HR</b> approves advances and manages workers. <b>Labour Incharge</b> creates and edits worker
          records and advance requests. <b>Project Manager</b> oversees assigned projects. <b>Accounts</b>
          disburses approved advances and tracks repayments. <b>Viewer</b> is read-only.
        </AlertDescription>
      </Alert>
    </div>
  );
}
