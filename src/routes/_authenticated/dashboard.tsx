import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/PageHeader";
import { inr } from "@/lib/format";
import {
  Users, HandCoins, Ban, TrendingUp, ArrowUpRight, UserPlus, PlusCircle, Activity,
  ClipboardCheck, ClipboardList, CircleCheck, CircleX, ShieldCheck,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, LineChart, Line,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CHART_TT = {
  contentStyle: {
    background: "var(--color-popover)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
  },
} as const;

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dashboard-kpis-v2"],
    queryFn: async () => {
      const heads = (b: any) => b as { count: number | null };
      const [tot, active, kycP, kycA, advP, advApr, advRej, blk] = await Promise.all([
        supabase.from("workers").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("status", "active").is("deleted_at", null),
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("kyc_status", "pending").is("deleted_at", null),
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("kyc_status", "approved").is("deleted_at", null),
        supabase.from("advances").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
        supabase.from("advances").select("id", { count: "exact", head: true }).eq("status", "approved").is("deleted_at", null),
        supabase.from("advances").select("id", { count: "exact", head: true }).eq("status", "rejected").is("deleted_at", null),
        supabase.from("workers").select("id", { count: "exact", head: true }).eq("status", "blacklisted").is("deleted_at", null),
      ]);
      return {
        total: heads(tot).count ?? 0,
        active: heads(active).count ?? 0,
        kycPending: heads(kycP).count ?? 0,
        kycApproved: heads(kycA).count ?? 0,
        advPending: heads(advP).count ?? 0,
        advApproved: heads(advApr).count ?? 0,
        advRejected: heads(advRej).count ?? 0,
        blacklisted: heads(blk).count ?? 0,
      };
    },
  });

  const byProject = useQuery({
    queryKey: ["workers-by-project"],
    queryFn: async () => {
      const { data } = await supabase.from("workers")
        .select("project_id, projects(name)").is("deleted_at", null);
      const map = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.projects?.name ?? "Unassigned";
        map.set(k, (map.get(k) ?? 0) + 1);
      });
      return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    },
  });

  const byTrade = useQuery({
    queryKey: ["workers-by-trade"],
    queryFn: async () => {
      const { data } = await supabase.from("workers")
        .select("trade_id, trades(name)").is("deleted_at", null);
      const map = new Map<string, number>();
      (data ?? []).forEach((r: any) => {
        const k = r.trades?.name ?? "Unassigned";
        map.set(k, (map.get(k) ?? 0) + 1);
      });
      return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    },
  });

  const monthly = useQuery({
    queryKey: ["workers-monthly"],
    queryFn: async () => {
      const { data } = await supabase.from("workers").select("created_at").is("deleted_at", null);
      const buckets: Record<string, number> = {};
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets[d.toISOString().slice(0, 7)] = 0;
      }
      (data ?? []).forEach((r: any) => {
        const k = String(r.created_at).slice(0, 7);
        if (k in buckets) buckets[k] += 1;
      });
      return Object.entries(buckets).map(([k, v]) => ({
        month: new Date(k + "-01").toLocaleString("en", { month: "short" }),
        count: v,
      }));
    },
  });

  const advTrend = useQuery({
    queryKey: ["adv-trend-v2"],
    queryFn: async () => {
      const { data } = await supabase.from("advances")
        .select("amount, status, request_date").is("deleted_at", null);
      const buckets: Record<string, { approved: number; pending: number }> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets[d.toISOString().slice(0, 7)] = { approved: 0, pending: 0 };
      }
      (data ?? []).forEach((r: any) => {
        const k = String(r.request_date).slice(0, 7);
        if (!(k in buckets)) return;
        const bucket = buckets[k];
        if (r.status === "approved") bucket.approved += Number(r.amount || 0);
        else if (r.status === "pending") bucket.pending += Number(r.amount || 0);
      });
      return Object.entries(buckets).map(([k, v]) => ({
        month: new Date(k + "-01").toLocaleString("en", { month: "short" }),
        ...v,
      }));
    },
  });

  const kpis = [
    { label: "Total Workers", value: stats.data?.total, icon: Users, tone: "text-info", bg: "bg-info/10", to: "/workers" },
    { label: "Active Workers", value: stats.data?.active, icon: Activity, tone: "text-success", bg: "bg-success/10", to: "/workers" },
    { label: "Pending KYC", value: stats.data?.kycPending, icon: ClipboardList, tone: "text-warning-foreground", bg: "bg-warning/15", to: "/workers" },
    { label: "Approved KYC", value: stats.data?.kycApproved, icon: ClipboardCheck, tone: "text-success", bg: "bg-success/10", to: "/workers" },
    { label: "Pending Advances", value: stats.data?.advPending, icon: HandCoins, tone: "text-warning-foreground", bg: "bg-warning/15", to: "/advances" },
    { label: "Approved Advances", value: stats.data?.advApproved, icon: CircleCheck, tone: "text-success", bg: "bg-success/10", to: "/advances" },
    { label: "Rejected Advances", value: stats.data?.advRejected, icon: CircleX, tone: "text-destructive", bg: "bg-destructive/10", to: "/advances" },
    { label: "Blacklisted", value: stats.data?.blacklisted, icon: Ban, tone: "text-destructive", bg: "bg-destructive/10", to: "/blacklist" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Executive Dashboard"
        description="Real-time signals across workforce, KYC, advances, and compliance."
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link to="/workers/new"><UserPlus className="size-4" /> <span className="hidden sm:inline">Add worker</span></Link></Button>
            <Button asChild size="sm"><Link to="/advances/new"><PlusCircle className="size-4" /> <span className="hidden sm:inline">New advance</span></Link></Button>
          </>
        }
      />

      {/* KPI grid — 2 col mobile, 4 col tablet+, 4x2 laptop+ */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="group">
            <Card className="relative overflow-hidden transition hover:shadow-elevation-2 hover:border-primary/40">
              <CardContent className="p-3 sm:p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{k.label}</div>
                    <div className="mt-1.5 font-display text-xl sm:text-2xl font-bold tabular-nums truncate">
                      {stats.isLoading ? <Skeleton className="h-7 w-14" /> : (k.value ?? 0)}
                    </div>
                  </div>
                  <div className={`grid size-8 sm:size-9 shrink-0 place-items-center rounded-md ${k.bg}`}>
                    <k.icon className={`size-4 ${k.tone}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Charts row 1 — Monthly registrations + Advance trends */}
      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Monthly registrations
            </CardTitle>
            <Badge variant="outline">12 months</Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] sm:h-[280px]">
              <ResponsiveContainer>
                <AreaChart data={monthly.data ?? []} margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gReg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...CHART_TT} />
                  <Area type="monotone" dataKey="count" stroke="var(--color-primary)" fill="url(#gReg)" strokeWidth={2} name="Workers" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <HandCoins className="size-4 text-primary" /> Advance trends (6 months)
            </CardTitle>
            <Badge variant="outline">₹ INR</Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] sm:h-[280px]">
              <ResponsiveContainer>
                <LineChart data={advTrend.data ?? []} margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
                  <Tooltip {...CHART_TT} formatter={(v: any) => inr(v)} />
                  <Line type="monotone" dataKey="approved" stroke="var(--color-success, #16a34a)" strokeWidth={2} dot={false} name="Approved" />
                  <Line type="monotone" dataKey="pending" stroke="var(--color-warning, #f59e0b)" strokeWidth={2} dot={false} name="Pending" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 — By project + By trade */}
      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Workers by project
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] sm:h-[280px]">
              <ResponsiveContainer>
                <BarChart data={byProject.data ?? []} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip {...CHART_TT} />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Users className="size-4 text-primary" /> Workers by trade
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[240px] sm:h-[280px]">
              <ResponsiveContainer>
                <BarChart data={byTrade.data ?? []} margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...CHART_TT} />
                  <Bar dataKey="value" fill="var(--color-info, #3b82f6)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/workers", label: "Manage workers", icon: Users },
          { to: "/advances", label: "Advance ledger", icon: HandCoins },
          { to: "/documents", label: "Generate documents", icon: ClipboardCheck },
          { to: "/admin/audit", label: "Audit trail", icon: ShieldCheck },
        ].map((q) => (
          <Button key={q.to} asChild variant="outline" className="justify-between h-auto py-3">
            <Link to={q.to}>
              <span className="flex items-center gap-2"><q.icon className="size-4 text-primary" />{q.label}</span>
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        ))}
      </div>
    </>
  );
}
