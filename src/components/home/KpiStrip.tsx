import { animate, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "../../db/useQuery";
import { confusion, median } from "../../lib/stats";

/** Counts up to `value` once when it scrolls into view; shows the final value at rest. */
function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!inView || reduce || !Number.isFinite(value)) return;
    const c = animate(0, value, { duration: 1.1, ease: [0.2, 0.8, 0.2, 1], onUpdate: setShown, onComplete: () => setShown(null) });
    return () => c.stop();
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {format(shown ?? value)}
    </span>
  );
}

export function KpiStrip() {
  const totals = useQuery<{ otif: number; delivered: number }>(
    "SELECT AVG(otif) AS otif, COUNT(*) AS delivered FROM orders WHERE cancelled = 0",
  ).rows[0];
  const scored = useQuery<{ risk_score: number; on_time: number }>("SELECT risk_score, on_time FROM orders WHERE cancelled = 0").rows;
  const lead = useQuery<{ h: number }>("SELECT alert_lead_hours AS h FROM orders WHERE cancelled = 0 AND alert = 1").rows;

  const ready = Boolean(totals && scored.length && lead.length);
  const recall = ready ? confusion(scored.map((r) => r.risk_score), scored.map((r) => 1 - r.on_time), 50).recall : 0;
  const medianLead = ready ? median(lead.map((r) => r.h)) : 0;

  const tiles = [
    { label: "OTIF", value: totals?.otif ?? 0, fmt: (n: number) => `${(n * 100).toFixed(1)}%`, note: "Delivered on time and in full" },
    { label: "Late orders caught by alerts", value: recall, fmt: (n: number) => `${Math.round(n * 100)}%`, note: "At the alert threshold of 50" },
    { label: "Median warning", value: medianLead, fmt: (n: number) => `${n.toFixed(1)} h`, note: "Before the promised delivery time" },
    { label: "Orders analysed", value: totals?.delivered ?? 0, fmt: (n: number) => Math.round(n).toLocaleString("en-US"), note: "25 weeks, April to September 2026" },
  ];

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-card border border-border bg-border lg:grid-cols-4" style={{ gap: 1 }}>
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col bg-surface p-5 sm:p-6">
          <dt className="order-2 mt-1 text-sm font-medium text-ink">{t.label}</dt>
          <dd className="order-1 text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.1]">
            {ready ? <CountUp value={t.value} format={t.fmt} /> : <span className="inline-block h-9 w-24 animate-pulse rounded-md bg-subtle align-middle" />}
          </dd>
          <dd className="order-3 mt-1 text-xs text-muted">{t.note}</dd>
        </div>
      ))}
    </dl>
  );
}
