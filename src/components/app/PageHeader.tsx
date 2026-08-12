import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, actions, breadcrumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span>/</span>}
                {b.to ? <a href={b.to} className="hover:text-foreground">{b.label}</a> : <span>{b.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusPill({ status, tone = "neutral", className }: {
  status: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}) {
  const tones = {
    success: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/15 text-warning-foreground border-warning/40",
    danger: "bg-destructive/10 text-destructive border-destructive/30",
    info: "bg-info/10 text-info border-info/30",
    neutral: "bg-muted text-muted-foreground border-border",
  } as const;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
      tones[tone], className,
    )}>
      <span className={cn(
        "size-1.5 rounded-full",
        tone === "success" && "bg-success",
        tone === "warning" && "bg-warning",
        tone === "danger" && "bg-destructive",
        tone === "info" && "bg-info",
        tone === "neutral" && "bg-muted-foreground",
      )} />
      {status}
    </span>
  );
}
