import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "../../db/useQuery";
import { pct } from "../../lib/format";
import { summary } from "../../lib/summary";

function Teaser({ title, chart, decision, className = "" }: { title: string; chart: ReactNode; decision: string; className?: string }) {
  return (
    <article className={`card flex flex-col p-6 ${className}`}>
      <h3 className="max-w-xl text-lg font-semibold leading-snug tracking-tight">{title}</h3>
      <div className="flex-1 py-6">{chart}</div>
      <p className="border-t border-border pt-4 text-sm text-muted">
        <span className="font-semibold text-ink">Decision: </span>
        {decision}
      </p>
    </article>
  );
}

function HBar({ label, value, tone }: { label: string; value: number; tone: "primary" | "accent" }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="num font-semibold">{pct(value, 0)}</span>
      </div>
      <div className="mt-1.5 h-3 rounded-full bg-subtle">
        <div className={`h-full rounded-full ${tone === "primary" ? "bg-primary" : "bg-accent"}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

export function InsightTeasers() {
  const gk = useQuery<{ share_orders: number; share_late: number }>(
    `SELECT AVG(vendor_id IN ('VG','VK')) AS share_orders,
            (SELECT AVG(vendor_id IN ('VG','VK')) FROM orders WHERE cancelled = 0 AND on_time = 0) AS share_late
     FROM orders WHERE cancelled = 0`,
  ).rows[0];
  const vendors = useQuery<{ vendor_id: string; vendor_name: string; otif: number }>(
    `SELECT o.vendor_id, v.vendor_name, AVG(o.otif) AS otif FROM orders o JOIN vendors v USING (vendor_id)
     WHERE o.cancelled = 0 GROUP BY o.vendor_id ORDER BY otif`,
  ).rows;
  const season = useQuery<{ monsoon: number; late_rate: number }>(
    `SELECT monsoon, AVG(1 - on_time) AS late_rate FROM orders WHERE cancelled = 0 GROUP BY monsoon ORDER BY monsoon`,
  ).rows;
  const dry = season.find((r) => r.monsoon === 0)?.late_rate ?? 0;
  const wet = season.find((r) => r.monsoon === 1)?.late_rate ?? 0;
  const early = summary.watchlist_at_order;
  const dispatch = summary.alert_at_50;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Teaser
        className="lg:col-span-2"
        title="Two vendors cause half the late deliveries, and they win because they are cheaper"
        chart={
          <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-12">
            <div className="space-y-5">
              <HBar label="Vendors G and K, share of all orders" value={gk?.share_orders ?? 0} tone="primary" />
              <HBar label="Vendors G and K, share of late deliveries" value={gk?.share_late ?? 0} tone="accent" />
            </div>
            <figure>
              <div className="flex h-36 items-end gap-1.5 sm:gap-2" role="img" aria-label="OTIF by vendor, lowest first">
                {vendors.map((v) => {
                  const hot = v.vendor_id === "VG" || v.vendor_id === "VK";
                  return (
                    <div key={v.vendor_id} className="group flex h-full flex-1 flex-col items-center justify-end">
                      <span className={`num mb-1 text-[10px] ${hot ? "font-semibold text-accent-ink" : "text-muted"}`}>
                        {Math.round(v.otif * 100)}
                      </span>
                      <div
                        className={`w-full rounded-t-md ${hot ? "bg-accent" : "bg-primary/25"}`}
                        style={{ height: `${v.otif * 100}%` }}
                        title={`${v.vendor_name}: ${pct(v.otif)} OTIF`}
                      />
                      <span className={`mt-1.5 text-[11px] ${hot ? "font-semibold text-ink" : "text-muted"}`}>
                        {v.vendor_name.replace("Vendor ", "")}
                      </span>
                    </div>
                  );
                })}
              </div>
              <figcaption className="mt-2 text-xs text-muted">OTIF % by vendor, lowest first. G and K in orange.</figcaption>
            </figure>
          </div>
        }
        decision="Show reliability next to price when a procurement manager picks a vendor."
      />
      <Teaser
        title="One bad week is mostly noise. The monsoon is a real shift."
        chart={
          <div className="flex items-end gap-6 sm:gap-10">
            {[
              { label: "Dry season", v: dry, tone: "bg-primary" },
              { label: "Monsoon", v: wet, tone: "bg-accent" },
            ].map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-start">
                <span className="num text-2xl font-semibold">{pct(b.v)}</span>
                <span className="text-xs text-muted">late, {b.label.toLowerCase()}</span>
                <div className="mt-3 flex h-24 w-full items-end rounded-md bg-subtle">
                  <div className={`w-full rounded-md ${b.tone}`} style={{ height: `${(b.v / 0.35) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        }
        decision="Build a monsoon playbook instead of reacting to single bad weeks."
      />
      <Teaser
        title="Early warnings come early but are often wrong"
        chart={
          <div className="space-y-5">
            {[
              { label: "Early watch, when the order is placed", lead: `${Math.round(early.lead_median_h)} h`, right: early.precision, tone: "accent" as const },
              { label: "Delay alert, at dispatch", lead: `${dispatch.lead_median_h} h`, right: dispatch.precision, tone: "primary" as const },
            ].map((r) => (
              <div key={r.label}>
                <p className="text-sm font-medium">{r.label}</p>
                <p className="mt-0.5 text-sm text-muted">
                  <span className="num font-semibold text-ink">{r.lead}</span> of warning,{" "}
                  <span className="num font-semibold text-ink">{pct(r.right, 0)}</span> of alerts right
                </p>
                <div className="mt-2 h-2 rounded-full bg-subtle">
                  <div className={`h-full rounded-full ${r.tone === "primary" ? "bg-primary" : "bg-accent"}`} style={{ width: `${r.right * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        }
        decision="Ship the dispatch alert first, then add live GPS tracking."
      />
    </div>
  );
}

export function InsightsLink() {
  return (
    <Link to="/insights" className="link inline-flex items-center gap-1 text-sm">
      Read all eight insights
      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
    </Link>
  );
}
