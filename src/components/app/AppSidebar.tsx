import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, HandCoins, Ban, Shield, ChevronRight, FileText,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Logo } from "./Logo";


type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const items: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/workers", label: "Worker KYC", icon: Users },
  { to: "/advances", label: "Advance (Kharchi)", icon: HandCoins },
  { to: "/blacklist", label: "Blacklist", icon: Ban },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/admin", label: "Admin", icon: Shield },
];

export function AppSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const [hover, setHover] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const expanded = mobile || hover;

  return (
    <aside
      onMouseEnter={() => !mobile && setHover(true)}
      onMouseLeave={() => !mobile && setHover(false)}
      className={cn(
        "group/sidebar relative z-30 flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
        mobile ? "w-full" : (expanded ? "w-[280px]" : "w-[80px]"),
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 border-b px-5">
        <Logo size={40} />
        <div className={cn("min-w-0 overflow-hidden transition-opacity", expanded ? "opacity-100" : "opacity-0")}>
          <div className="font-display text-sm font-bold tracking-tight truncate">
            Ashish<span className="text-primary">Interbuild</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">Workforce Suite</div>
        </div>
      </div>


      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-1 px-3">
          {items.map((it) => {
            const active = path === it.to || path.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={onNavigate}
                className={cn(
                  "group/link relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {active && (
                  <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-primary" aria-hidden />
                )}
                <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
                <span className={cn("truncate transition-opacity", expanded ? "opacity-100" : "opacity-0 w-0")}>
                  {it.label}
                </span>
                {expanded && active && <ChevronRight className="ml-auto size-4 text-muted-foreground" />}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className={cn("border-t p-4 text-[11px] text-muted-foreground transition-opacity", expanded ? "opacity-100" : "opacity-0")}>
        v1.0 · Enterprise
      </div>
    </aside>
  );
}

export function AppShell({ children, header }: { children: ReactNode; header: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background">
      <div className="hidden lg:block">
        <AppSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
