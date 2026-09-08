import { ReactNode } from "react";

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="section-title">{children}</h2>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "brand" | "flame";
}) {
  return (
    <div className="card card-pad">
      <div className="caption">{label}</div>
      <div
        className={`stat-number num mt-2 ${
          accent === "flame" ? "text-flame-500" : accent === "brand" ? "text-brand-600 dark:text-brand-300" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="caption mt-1.5">{sub}</div>}
    </div>
  );
}

export function ProgressBar({ rate, color }: { rate: number; color?: string }) {
  return (
    <div className="progress">
      <div
        className="progress-bar"
        style={{ width: `${Math.min(100, Math.max(0, rate))}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10 text-brand-500 dark:text-brand-300">
          {icon}
        </div>
      )}
      <div className="text-sm font-medium text-ink">{title}</div>
      {desc && <div className="caption max-w-xs">{desc}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function PageLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="加载中">
      <Skeleton className="h-28 w-full rounded-card" />
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2.5">
        <Skeleton className="h-16 w-full rounded-card" />
        <Skeleton className="h-16 w-full rounded-card" />
        <Skeleton className="h-16 w-full rounded-card" />
      </div>
    </div>
  );
}
