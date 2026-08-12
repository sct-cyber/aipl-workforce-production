import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AppRole =
  | "super_admin"
  | "admin"
  | "hr"
  | "labour_incharge"
  | "project_manager"
  | "accounts"
  | "viewer";

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  labour_incharge: "Labour Incharge",
  project_manager: "Project Manager",
  accounts: "Accounts",
  viewer: "Viewer",
};

export const ALL_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "hr",
  "labour_incharge",
  "project_manager",
  "accounts",
  "viewer",
];

const STAFF: AppRole[] = ["super_admin", "admin", "hr", "labour_incharge", "project_manager", "accounts"];
const EDITORS: AppRole[] = ["super_admin", "admin", "hr", "labour_incharge"];

export function useRoles() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["user_roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
  const roles = q.data ?? [];
  const primary = (roles[0] ?? "viewer") as AppRole;
  return {
    roles,
    primary,
    primaryLabel: ROLE_LABELS[primary],
    loading: q.isLoading,
    isSuperAdmin: roles.includes("super_admin"),
    isAdmin: roles.some((r) => r === "super_admin" || r === "admin"),
    isStaff: roles.some((r) => STAFF.includes(r)),
    canEdit: roles.some((r) => EDITORS.includes(r)),
    hasRole: (r: AppRole) => roles.includes(r),
  };
}
