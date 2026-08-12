import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, ALL_ROLES, ROLE_LABELS, type AppRole } from "@/hooks/use-role";
import {
  adminCreateUser, adminUpdateUser, adminResetPassword, adminDeleteUser,
} from "@/lib/admin-users.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ShieldAlert, UserPlus, MoreHorizontal, KeyRound, Trash2, Pencil, Mail, Loader2,
} from "lucide-react";
import { fmtDate, initials } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

type UserRow = {
  id: string; email: string; full_name: string | null;
  phone: string | null; avatar_url: string | null;
  is_active: boolean; created_at: string;
  roles: AppRole[]; project_ids: string[];
};

function UsersAdmin() {
  const qc = useQueryClient();
  const { isAdmin } = useRoles();
  const [openCreate, setOpenCreate] = useState(false);
  const [edit, setEdit] = useState<UserRow | null>(null);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);
  const [deleteFor, setDeleteFor] = useState<UserRow | null>(null);

  const projectsQ = useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name, code").is("deleted_at", null).order("name");
      return data ?? [];
    },
  });

  const list = useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: assigns }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
        supabase.from("user_projects").select("user_id, project_id"),
      ]);
      const roleMap: Record<string, AppRole[]> = {};
      (roles ?? []).forEach((r: any) => { (roleMap[r.user_id] ??= []).push(r.role); });
      const projMap: Record<string, string[]> = {};
      (assigns ?? []).forEach((a: any) => { (projMap[a.user_id] ??= []).push(a.project_id); });
      return (profiles ?? []).map((p: any) => ({
        ...p, roles: roleMap[p.id] ?? [], project_ids: projMap[p.id] ?? [],
      }));
    },
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  if (!isAdmin) {
    return (
      <Alert>
        <ShieldAlert className="size-4" />
        <AlertDescription>Only Super Admins and Admins can manage users.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Users & Roles</h2>
          <p className="text-sm text-muted-foreground">Create, edit, deactivate, and assign roles or projects.</p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>
          <UserPlus className="size-4 mr-1.5" /> New user
        </Button>
      </div>

      <Card>
        <Table className="table-dense">
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list.data ?? []).map((u) => {
              const primary = (u.roles[0] ?? "viewer") as AppRole;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="size-8">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {initials(u.full_name || u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium truncate">{u.full_name || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell className="text-xs">{u.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABELS[primary]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {u.project_ids.length === 0 ? (
                      <span className="text-muted-foreground">All / none</span>
                    ) : (
                      <Badge variant="outline">{u.project_ids.length} assigned</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "destructive"}>
                      {u.is_active ? "Active" : "Deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(u.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEdit(u)}>
                          <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetFor(u)}>
                          <KeyRound className="size-4" /> Reset password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteFor(u)}>
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {(list.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {list.isLoading ? "Loading…" : "No users yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <CreateUserDialog open={openCreate} onOpenChange={setOpenCreate} projects={projectsQ.data ?? []} onDone={refetch} />
      {edit && (
        <EditUserDialog user={edit} projects={projectsQ.data ?? []} onClose={() => setEdit(null)} onDone={refetch} />
      )}
      {resetFor && (
        <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} />
      )}
      {deleteFor && (
        <DeleteDialog user={deleteFor} onClose={() => setDeleteFor(null)} onDone={refetch} />
      )}
    </div>
  );
}

// ── Create ──────────────────────────────────────────────────────────────
function CreateUserDialog({
  open, onOpenChange, projects, onDone,
}: { open: boolean; onOpenChange: (v: boolean) => void; projects: any[]; onDone: () => void }) {
  const createFn = useServerFn(adminCreateUser);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [sendInvite, setSendInvite] = useState(true);

  const m = useMutation({
    mutationFn: () => createFn({ data: {
      email, fullName, tempPassword: password, phone: phone || undefined,
      role, projectIds, sendInvite,
    }}),
    onSuccess: () => {
      toast.success("User created");
      onDone();
      onOpenChange(false);
      setEmail(""); setFullName(""); setPhone(""); setPassword(""); setRole("viewer"); setProjectIds([]);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create user"),
  });

  const genPw = () => setPassword(Math.random().toString(36).slice(2, 10) + "Aa1!");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create new user</DialogTitle>
          <DialogDescription>Set a temporary password. User will be required to change it on first sign-in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div>
            <Label>Temporary password</Label>
            <div className="flex gap-2">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars" />
              <Button type="button" variant="outline" onClick={genPw}>Generate</Button>
            </div>
          </div>
          <div>
            <Label>Role</Label>
            <RoleSelect value={role} onChange={setRole} />
          </div>
          <div>
            <Label>Assign projects (optional)</Label>
            <ProjectPicker projects={projects} value={projectIds} onChange={setProjectIds} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Checkbox id="inv" checked={sendInvite} onCheckedChange={(v) => setSendInvite(v === true)} />
            <Label htmlFor="inv" className="text-sm font-normal cursor-pointer">
              Also send a password-reset email
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !email || !fullName || password.length < 8}>
            {m.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit ────────────────────────────────────────────────────────────────
function EditUserDialog({
  user, projects, onClose, onDone,
}: { user: UserRow; projects: any[]; onClose: () => void; onDone: () => void }) {
  const updateFn = useServerFn(adminUpdateUser);
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState<AppRole>((user.roles[0] ?? "viewer") as AppRole);
  const [projectIds, setProjectIds] = useState<string[]>(user.project_ids);
  const [isActive, setIsActive] = useState(user.is_active);

  const m = useMutation({
    mutationFn: () => updateFn({ data: {
      userId: user.id, fullName, phone, isActive, role, projectIds,
    }}),
    onSuccess: () => { toast.success("User updated"); onDone(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription className="font-mono text-xs">{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div><Label>Role</Label><RoleSelect value={role} onChange={setRole} /></div>
          <div>
            <Label>Assigned projects</Label>
            <ProjectPicker projects={projects} value={projectIds} onChange={setProjectIds} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Account active</div>
              <div className="text-xs text-muted-foreground">Deactivated users cannot sign in.</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset password ──────────────────────────────────────────────────────
function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const resetFn = useServerFn(adminResetPassword);
  const [newPw, setNewPw] = useState("");

  const sendEmail = useMutation({
    mutationFn: () => resetFn({ data: { userId: user.id, sendEmail: true } }),
    onSuccess: () => { toast.success("Password reset email sent"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  const setTemp = useMutation({
    mutationFn: () => resetFn({ data: { userId: user.id, newPassword: newPw } }),
    onSuccess: () => { toast.success("Temporary password set — share it securely with the user"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription className="font-mono text-xs">{user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">Option A — Email reset link</div>
            <p className="text-xs text-muted-foreground">Sends a secure password-reset link to the user's email.</p>
            <Button size="sm" onClick={() => sendEmail.mutate()} disabled={sendEmail.isPending}>
              {sendEmail.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              <Mail className="size-4 mr-1.5" /> Send email
            </Button>
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <div className="text-sm font-medium">Option B — Set a temporary password</div>
            <p className="text-xs text-muted-foreground">User will be required to change it on next sign-in.</p>
            <div className="flex gap-2">
              <Input value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 8 chars" />
              <Button size="sm" variant="outline" onClick={() => setTemp.mutate()} disabled={setTemp.isPending || newPw.length < 8}>
                {setTemp.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Apply
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete ──────────────────────────────────────────────────────────────
function DeleteDialog({ user, onClose, onDone }: { user: UserRow; onClose: () => void; onDone: () => void }) {
  const deleteFn = useServerFn(adminDeleteUser);
  const m = useMutation({
    mutationFn: () => deleteFn({ data: { userId: user.id } }),
    onSuccess: () => { toast.success("User deleted"); onDone(); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            This permanently deletes <b>{user.full_name || user.email}</b> and all their access.
            Prefer deactivation to keep audit history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => m.mutate()} disabled={m.isPending}>
            {m.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Shared controls ─────────────────────────────────────────────────────
function RoleSelect({ value, onChange }: { value: AppRole; onChange: (v: AppRole) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AppRole)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {ALL_ROLES.map((r) => (<SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>))}
      </SelectContent>
    </Select>
  );
}

function ProjectPicker({
  projects, value, onChange,
}: { projects: any[]; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  if (!projects.length) return <div className="text-xs text-muted-foreground border rounded-md p-3">No projects yet.</div>;
  return (
    <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
      {projects.map((p) => (
        <label key={p.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50">
          <Checkbox checked={value.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
          <span className="text-sm">{p.name}</span>
          {p.code && <span className="text-[10px] font-mono text-muted-foreground ml-auto">{p.code}</span>}
        </label>
      ))}
    </div>
  );
}
