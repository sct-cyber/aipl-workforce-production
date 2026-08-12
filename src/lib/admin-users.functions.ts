import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AppRoleEnum = z.enum([
  "super_admin",
  "admin",
  "hr",
  "labour_incharge",
  "project_manager",
  "accounts",
  "viewer",
]);

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_admin", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: {
    email: string;
    fullName: string;
    tempPassword: string;
    phone?: string;
    role: string;
    projectIds?: string[];
    sendInvite?: boolean;
  }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const role = AppRoleEnum.parse(data.role);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;

    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      email: data.email,
      full_name: data.fullName,
      phone: data.phone ?? null,
      is_active: true,
      must_change_password: true,
    });

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: role as any });

    if (data.projectIds?.length) {
      await supabaseAdmin.from("user_projects").insert(
        data.projectIds.map((pid) => ({ user_id: uid, project_id: pid, assigned_by: context.userId })),
      );
    }

    if (data.sendInvite) {
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
      });
    }

    return { userId: uid };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: {
    userId: string;
    fullName?: string;
    phone?: string;
    isActive?: boolean;
    role?: string;
    projectIds?: string[];
  }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, any> = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("profiles").update(patch as any).eq("id", data.userId);
    }

    if (data.role) {
      const role = AppRoleEnum.parse(data.role);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: role as any });
    }

    if (data.projectIds) {
      await supabaseAdmin.from("user_projects").delete().eq("user_id", data.userId);
      if (data.projectIds.length) {
        await supabaseAdmin.from("user_projects").insert(
          data.projectIds.map((pid) => ({ user_id: data.userId, project_id: pid, assigned_by: context.userId })),
        );
      }
    }

    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId: string; newPassword?: string; sendEmail?: boolean }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.newPassword) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.newPassword,
      });
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.userId);
      return { ok: true, mode: "temp_password" as const };
    }

    if (data.sendEmail) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", data.userId).single();
      if (!prof?.email) throw new Error("User email not found");
      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: prof.email,
      });
      if (error) throw new Error(error.message);
      return { ok: true, mode: "email_sent" as const };
    }

    throw new Error("Provide newPassword or sendEmail");
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: { userId: string }) => v)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
