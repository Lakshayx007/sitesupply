import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Phone, Repeat2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "../../db/useQuery";
import { HERO_ORDER_ID, ORDER_COLUMNS, hhmm, reasonsFor, type OrderRow } from "../../lib/orders";
import { StatusChip } from "../ui";

const STEPS = [
  {
    title: "Watch every order",
    body: "Every order of cement, steel, ready-mix concrete, sand and aggregate is followed from the moment it is placed: who supplies it, how far it travels and when the truck should leave the plant.",
  },
  {
    title: "Score the risk",
    body: "Simple rules that anyone can check add points for each warning sign. At 50 points or more, the order is marked At risk. No black box: the site engineer can see exactly why.",
  },
  {
    title: "Alert with reasons and actions",
    body: "The alert says why in plain words and offers three next steps: call the vendor, switch to a backup vendor, or move the crew to other work.",
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const visuals = [<WatchVisual key="w" />, <ScoreVisual key="s" />, <AlertVisual key="a" />];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
      <ol className="relative">
        {/* progress rail */}
        <span aria-hidden="true" className="absolute bottom-8 left-[15px] top-8 hidden w-px bg-border lg:block" />
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            ref={(el) => {
              refs.current[i] = el as HTMLDivElement | null;
            }}
            data-step={i}
            className="relative flex flex-col justify-center py-8 lg:min-h-[54vh] lg:py-0"
          >
            <div className="flex gap-5">
              <span
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-300 ${
                  active === i ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-muted"
                }`}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <h3 className={`text-2xl font-semibold tracking-tight transition-colors duration-300 ${active === i ? "text-ink" : "lg:text-muted"}`}>{s.title}</h3>
                <p className="mt-3 max-w-md text-base leading-relaxed text-muted">{s.body}</p>
              </div>
            </div>
            <div className="mt-6 lg:hidden">{visuals[i]}</div>
          </li>
        ))}
      </ol>

      <div className="hidden lg:block">
        <div className="sticky top-[calc(50vh-210px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {visuals[active]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function VisualCard({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="card overflow-hidden">
      <div className="p-5">{children}</div>
      <figcaption className="border-t border-border bg-subtle/60 px-5 py-3 text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

/* Step 1: a day of real sample orders */
function WatchVisual() {
  const { rows } = useQuery<{
    order_id: string;
    material: string;
    vendor_name: string;
    qty_ordered: number;
    unit: string;
    promised_ts: string;
    distance_km: number;
    risk_score: number;
  }>(
    `SELECT o.order_id, o.material, v.vendor_name, o.qty_ordered, o.unit, o.promised_ts, o.distance_km, o.risk_score
     FROM orders o JOIN vendors v USING (vendor_id)
     WHERE o.cancelled = 0 AND substr(o.promised_ts, 1, 10) = '2026-09-18'
     ORDER BY o.promised_ts LIMIT 6`,
  );
  return (
    <VisualCard caption="Sample orders due on 18 Sep 2026, with their status at the dispatch check.">
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.order_id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="num w-12 shrink-0 text-sm tabular-nums text-muted">{hhmm(r.promised_ts)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.material}</p>
              <p className="truncate text-xs text-muted">
                {r.qty_ordered} {r.unit === "m3" ? "m³" : r.unit} from {r.vendor_name}, {Math.round(r.distance_km)} km
              </p>
            </div>
            <StatusChip status={r.risk_score >= 50 ? "at-risk" : "on-track"} />
          </li>
        ))}
      </ul>
    </VisualCard>
  );
}

/* Step 2: the rules and their points */
function ScoreVisual() {
  const reduce = useReducedMotion();
  const { rows } = useQuery<{ d: number; v: number; k: number; r: number; m: number }>(
    `SELECT MAX(pts_dispatch_late) AS d, MAX(pts_vendor_recent_otif_below_80) AS v, MAX(pts_distance_over_50km) AS k,
            MAX(pts_ordered_under_24h) AS r, MAX(pts_monsoon) AS m FROM orders`,
  );
  const p = rows[0];
  if (!p) return <VisualCard caption="Loading">{null}</VisualCard>;
  const rules = [
    { pts: p.d, text: "Truck not out an hour after planned dispatch" },
    { pts: p.v, text: "Vendor on time and in full on under 80% of its last 10 orders" },
    { pts: p.k, text: "Site more than 50 km from the plant" },
    { pts: p.r, text: "Ordered less than 24 hours before it is needed" },
    { pts: p.m, text: "Monsoon season (June to September)" },
  ];
  const total = rules.reduce((a, r) => a + r.pts, 0);
  let acc = 0;
  return (
    <VisualCard caption={`Points per warning sign. They add up to ${total}; an alert goes out at 50.`}>
      <div className="relative">
        <div className="flex h-9 overflow-hidden rounded-lg">
          {rules.map((r, i) => {
            const left = acc;
            acc += r.pts;
            return (
              <motion.div
                key={r.text}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.08 * i, duration: 0.4 }}
                style={{ width: `${(r.pts / total) * 100}%`, transformOrigin: "left", opacity: 1 - i * 0.14 }}
                className="flex items-center justify-center border-r-2 border-surface bg-primary text-xs font-semibold text-primary-fg last:border-r-0"
                title={`${left}–${left + r.pts}`}
              >
                +{r.pts}
              </motion.div>
            );
          })}
        </div>
        <div className="absolute -bottom-2 -top-2 w-0.5 rounded bg-ink" style={{ left: `${(50 / total) * 100}%` }} aria-hidden="true" />
        <p className="mt-3 text-xs font-medium" style={{ paddingLeft: `calc(${(50 / total) * 100}% - 28px)` }}>
          Alert at 50
        </p>
      </div>
      <ul className="mt-4 space-y-2.5">
        {rules.map((r) => (
          <li key={r.text} className="flex items-baseline gap-3 text-sm">
            <span className="num w-9 shrink-0 text-right font-semibold text-primary-ink">+{r.pts}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </VisualCard>
  );
}

/* Step 3: the alert itself */
function AlertVisual() {
  const { rows } = useQuery<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM orders o JOIN vendors v USING (vendor_id) WHERE o.order_id = $id`,
    { $id: HERO_ORDER_ID },
  );
  const o = rows[0];
  if (!o) return <VisualCard caption="Loading">{null}</VisualCard>;
  const reasons = reasonsFor(o);
  return (
    <VisualCard caption={`Sample order ${o.order_id}. Reasons are written from the score's own points.`}>
      <div className="flex items-center justify-between gap-3">
        <StatusChip status="at-risk" />
        <span className="num text-sm text-muted">Score {o.risk_score}</span>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xl font-semibold leading-snug">
        <TriangleAlert aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-status-risk-ink" />
        Likely late by several hours
      </p>
      <p className="mt-1 text-sm text-muted">
        {o.material}, {o.qty_ordered} m³ from {o.vendor_name}, due {hhmm(o.promised_ts)}
      </p>
      <ul className="mt-4 space-y-2">
        {reasons.map((r) => (
          <li key={r.key} className="flex gap-3 text-sm">
            <span className="num w-8 shrink-0 text-right font-semibold text-primary-ink">+{r.points}</span>
            <span>{r.sentence}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 grid grid-cols-3 gap-2" aria-hidden="true">
        {[
          { icon: Phone, label: "Call vendor" },
          { icon: Repeat2, label: "Backup vendor" },
          { icon: CalendarClock, label: "Reschedule" },
        ].map(({ icon: Icon, label }, i) => (
          <span
            key={label}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold ${
              i === 0 ? "bg-primary text-primary-fg" : "border border-border text-ink"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </span>
        ))}
      </div>
    </VisualCard>
  );
}
