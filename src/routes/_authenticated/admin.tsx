import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Users, ScrollText, Settings, Shield, Building2, Wrench, Layers, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Overview", icon: Shield, exact: true },
  { to: "/admin/users", label: "Users & Roles", icon: Users },
  { to: "/admin/projects", label: "Projects", icon: Building2 },
  { to: "/admin/trades", label: "Trades", icon: Wrench },
  { to: "/admin/designations", label: "Designations", icon: Layers },
  { to: "/admin/templates", label: "Templates", icon: FileText },
  { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminLayout() {
  const path = useRouterState({ select: s => s.location.pathname });
  return (
    <>
      <PageHeader title="Admin" description="Users, roles, audit, and system settings." />
      <Card className="mb-4">
        <CardContent className="p-1.5 flex flex-wrap gap-1">
          {tabs.map(t => {
            const active = t.exact ? path === t.to : path.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <t.icon className="size-4" /> {t.label}
              </Link>
            );
          })}
        </CardContent>
      </Card>
      <Outlet />
    </>
  );
}
