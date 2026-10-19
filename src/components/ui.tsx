import { CircleCheck, Clock, Eye, LoaderCircle, Package, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SampleDataPill } from "./SampleDataPill";

/** Page title block used at the top of every page. `data` adds the Sample-data pill. */
export function PageHeader({
  eyebrow,
  title,
  children,
  data = true,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  data?: boolean;
}) {
  return (
    <div className="mx-auto max-w-page px-4 pb-6 pt-10 sm:px-6 sm:pt-14">
      <div className="flex flex-wrap items-center gap-3">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {data && <SampleDataPill />}
      </div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 max-w-3xl text-base text-muted sm:text-lg">{children}</div>}
    </div>
  );
}

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-page px-4 sm:px-6 ${className}`}>{children}</section>;
}

/** KPI tile: big number, small label, note underneath. */
export function KpiTile({
  label,
  value,
  note,
  loading = false,
}: {
  label: string;
  value: string;
  note?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="num mt-2 text-2xl font-semibold sm:text-3xl tracking-tight text-ink" aria-live="polite">
        {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded-md bg-subtle align-middle" aria-label="Loading" /> : value}
      </p>
      {note && <p className="mt-1.5 text-xs text-muted">{note}</p>}
    </div>
  );
}

/** Placeholder listing what a page will contain once it is built (Sessions 2–5). */
export function Planned({ session, items }: { session: number; items: string[] }) {
  return (
    <div className="panel border border-dashed border-border p-6">
      <p className="eyebrow">Coming in build session {session}</p>
      <ul className="mt-3 grid gap-2 text-sm text-ink sm:grid-cols-2">
        {items.map((i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Loading({ label = "Loading the sample database…" }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-muted">
      <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}

/* ---------- Status chips: colour + icon + label, never colour alone ---------- */

export type Status = "on-track" | "watch" | "at-risk" | "late" | "delivered" | "delivered-late" | "delivered-short";

const STATUS: Record<Status, { label: string; icon: LucideIcon; cls: string }> = {
  "on-track": { label: "On track", icon: CircleCheck, cls: "border-status-good/40 bg-status-good/10 text-status-good-ink" },
  watch: { label: "Watch", icon: Eye, cls: "border-status-watch/50 bg-status-watch/10 text-status-watch-ink" },
  "at-risk": { label: "At risk", icon: TriangleAlert, cls: "border-status-risk/50 bg-status-risk/10 text-status-risk-ink" },
  late: { label: "Delayed", icon: Clock, cls: "border-status-late/40 bg-status-late/10 text-status-late-ink" },
  delivered: { label: "Delivered", icon: CircleCheck, cls: "border-status-good/40 bg-status-good/10 text-status-good-ink" },
  "delivered-late": { label: "Delivered late", icon: Clock, cls: "border-status-late/40 bg-status-late/10 text-status-late-ink" },
  "delivered-short": { label: "Delivered short", icon: Package, cls: "border-status-risk/50 bg-status-risk/10 text-status-risk-ink" },
};

export function StatusChip({ status }: { status: Status }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}
