import { useState } from "react";
import { useNavigate, useRouter, Link } from "@tanstack/react-router";
import { Bell, Menu, Moon, Sun, LogOut, User as UserIcon, Settings, CheckCheck, ClipboardList, ClipboardCheck, HandCoins, Ban, UserPlus } from "lucide-react";
import { Logo } from "./Logo";

import { Button } from "@/components/ui/button";

import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-role";
import { useAvatarUrl } from "@/hooks/use-avatar";
import { AppSidebar } from "./AppSidebar";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { initials, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { theme, toggle } = useTheme();
  const { user, profile, signOut } = useAuth();
  const { primaryLabel } = useRoles();
  const navigate = useNavigate();
  const router = useRouter();
  const [openMobile, setOpenMobile] = useState(false);
  const avatarUrl = useAvatarUrl(profile?.avatar_url);
  const qc = useQueryClient();

  const notifQ = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*")
        .eq("user_id", user!.id).order("created_at", { ascending: false }).limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });
  const unread = (notifQ.data ?? []).filter((n) => !n.read).length;

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      await supabase.from("notifications").update({ read: true }).in("id", ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });


  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/auth" });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur md:px-6">
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden"><Menu className="size-5" /></Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[280px]">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar mobile onNavigate={() => setOpenMobile(false)} />
        </SheetContent>
      </Sheet>

      <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
        <Logo size={32} />
        <span className="font-display text-sm font-bold tracking-tight">
          Ashish<span className="text-primary">Interbuild</span>
        </span>
      </Link>

      <div className="hidden lg:flex items-center gap-2 pl-1">
        <Logo size={32} />
        <span className="font-display text-sm font-semibold tracking-tight text-muted-foreground">
          Workforce Suite
        </span>
      </div>


      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[calc(100vw-1rem)] max-w-sm p-0">
            <div className="border-b p-3 flex items-center justify-between gap-2">
              <div className="font-semibold text-sm">Notifications</div>
              <div className="flex items-center gap-2">
                {unread > 0 && <Badge variant="secondary" className="h-5">{unread} new</Badge>}
                {unread > 0 && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                    onClick={() => markRead.mutate((notifQ.data ?? []).filter(n => !n.read).map(n => n.id))}>
                    <CheckCheck className="size-3.5" /> Mark all
                  </Button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-auto">
              {(notifQ.data ?? []).length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">You're all caught up.</div>
              ) : (notifQ.data ?? []).map((n) => {
                const Icon = notifIcon(n.type);
                const inner = (
                  <div className={cn(
                    "flex items-start gap-3 p-3 border-b last:border-b-0 transition-colors",
                    n.read ? "hover:bg-muted/50" : "bg-primary/[0.04] hover:bg-primary/[0.08]",
                  )}>
                    <div className={cn("grid size-8 shrink-0 place-items-center rounded-md",
                      n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                      <div className="text-[11px] text-muted-foreground mt-1">{fmtDateTime(n.created_at)}</div>
                    </div>
                    {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} to={n.link} onClick={() => !n.read && markRead.mutate([n.id])} className="block">
                    {inner}
                  </Link>
                ) : (
                  <button key={n.id} onClick={() => !n.read && markRead.mutate([n.id])} className="w-full text-left">
                    {inner}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="ml-1 flex items-center gap-2 pl-1.5 pr-1.5 md:pr-3 h-11">
              <Avatar className="size-8">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={profile?.full_name ?? ""} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                  {initials(profile?.full_name || user?.user_metadata?.full_name || user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <div className="text-xs font-semibold leading-tight truncate max-w-[160px]">
                  {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0]}
                </div>
                <div className="text-[10px] text-primary leading-tight truncate max-w-[160px] font-medium">
                  {primaryLabel}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  {avatarUrl && <AvatarImage src={avatarUrl} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                    {initials(profile?.full_name || user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{profile?.full_name || user?.email?.split("@")[0]}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
                  <Badge variant="secondary" className="mt-1 h-4 px-1.5 text-[10px]">{primaryLabel}</Badge>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
              <UserIcon className="size-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/admin/settings" })}>
              <Settings className="size-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="size-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function notifIcon(type?: string | null) {
  switch (type) {
    case "kyc_submitted": return ClipboardList;
    case "kyc_approved": return ClipboardCheck;
    case "advance_requested":
    case "advance_approved":
    case "advance_rejected": return HandCoins;
    case "blacklist_alert": return Ban;
    case "user_created": return UserPlus;
    default: return Bell;
  }
}
