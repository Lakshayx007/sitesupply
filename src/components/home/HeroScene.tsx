import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, Factory, MapPin, Phone, RotateCcw, Repeat2, CalendarClock, TriangleAlert, Truck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "../../db/useQuery";
import { HERO_ORDER_ID, ORDER_COLUMNS, hhmm, reasonsFor, type OrderRow } from "../../lib/orders";
import { PhoneFrame } from "../PhoneFrame";
import { StatusChip } from "../ui";

/*
  The one orchestrated moment on the site: a real late order from the sample data,
  replayed. The clock runs up to the dispatch check, the truck never leaves, the
  score assembles from its reasons, and the alert lands on the site engineer's phone.
*/

const RUN_MS = 4200; // clock runs from 50 min before planned dispatch to the check
const CHIP_GAP = 420;
const THRESHOLD = 50;

const toMin = (ts: string) => Date.parse(ts.replace(" ", "T") + ":00Z") / 60000;
const fmt = (min: number) => {
  const d = new Date(min * 60000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

function useTimeline(total: number, ready: boolean) {
  const reduce = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [run, setRun] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!ready) return;
    if (reduce) {
      setElapsed(total);
      return;
    }
    const start = performance.now() + 500; // brief pause so the page settles first
    const tick = (now: number) => {
      const e = Math.max(0, now - start);
      setElapsed(Math.min(e, total));
      if (e < total) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [ready, reduce, total, run]);

  const replay = useCallback(() => {
    setElapsed(0);
    setRun((r) => r + 1);
  }, []);

  return { elapsed, replay, done: elapsed >= total };
}

export function HeroScene() {
  const { rows } = useQuery<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM orders o JOIN vendors v USING (vendor_id) WHERE o.order_id = $id`,
    { $id: HERO_ORDER_ID },
  );
  const o = rows[0] as OrderRow | undefined;
  const reasons = useMemo(() => (o ? reasonsFor(o) : []), [o]);

  const chipsStart = RUN_MS + 300;
  const alertAt = chipsStart + reasons.length * CHIP_GAP + 350;
  const outcomeAt = alertAt + 1900;
  const total = outcomeAt + 100;
  const { elapsed, replay, done } = useTimeline(total, Boolean(o));

  if (!o) return <SceneSkeleton />;

  const tStart = toMin(o.dispatch_planned_ts) - 50;
  const tPlanned = toMin(o.dispatch_planned_ts);
  const tCheck = toMin(o.check_ts);
  const tPromised = toMin(o.promised_ts);
  const now = tStart + (tCheck - tStart) * Math.min(1, elapsed / RUN_MS);

  const shown = reasons.filter((_, i) => elapsed >= chipsStart + i * CHIP_GAP);
  const score = shown.reduce((a, r) => a + r.points, 0);
  const pastPlanned = now >= tPlanned;
  const alerted = elapsed >= alertAt;
  const showOutcome = elapsed >= outcomeAt;
  // Where the truck should be by now if it had left on time.
  const expected = Math.min(1, Math.max(0, (now - tPlanned) / (tPromised - tPlanned)));

  return (
    <div className="relative mx-auto w-full max-w-[640px] lg:max-w-none">
      <div className="grid items-end gap-6 sm:grid-cols-[1fr_auto] sm:gap-0">
        {/* Dispatch board */}
        <div className="card relative z-0 overflow-hidden p-5 sm:mb-14 sm:mr-[-40px] sm:pr-[60px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold">{o.material}</p>
              <p className="mt-0.5 text-sm text-muted">
                {o.qty_ordered} m³, sample order {o.order_id}
              </p>
            </div>
            <div className="text-right">
              <p className="num text-2xl font-semibold tabular-nums" aria-label={`Time ${fmt(now)}`}>
                {fmt(now)}
              </p>
              <p className="text-xs text-muted">{o.check_ts.slice(0, 10) === o.promised_ts.slice(0, 10) ? "Pour day" : "Day before"}</p>
            </div>
          </div>

          <RouteMap
            plant={o.vendor_name}
            site={o.site_name.replace(/ \(.*\)/, "")}
            km={Math.round(o.distance_km)}
            plannedOut={hhmm(o.dispatch_planned_ts)}
            due={hhmm(o.promised_ts)}
            late={pastPlanned}
            expected={expected}
          />

          <ScoreMeter score={score} reasons={shown} />
        </div>

        {/* Phone */}
        <div className="relative z-10 mx-auto sm:mx-0">
          <PhoneFrame width={276} time={fmt(now)} label="SiteSupply on a site engineer's phone">
            <PhoneScreen o={o} score={score} alerted={alerted} reasons={reasons} />
          </PhoneFrame>
        </div>
      </div>

      <div className="mt-4 flex min-h-[44px] flex-wrap items-center justify-between gap-3 text-sm">
        <AnimatePresence>
          {showOutcome && (
            <motion.p
              key="outcome"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md text-muted"
            >
              What happened: the truck left at {hhmm(o.dispatch_actual_ts)} and arrived{" "}
              <strong className="font-semibold text-ink">{o.delay_hours?.toFixed(1)} hours late</strong>. The alert went out{" "}
              {o.alert_lead_hours?.toFixed(1)} hours before the promised time.
            </motion.p>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={replay}
          disabled={!done}
          className="btn-secondary ml-auto px-3 py-2 disabled:opacity-0"
          aria-hidden={!done}
          tabIndex={done ? 0 : -1}
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Replay
        </button>
      </div>
      <p className="sr-only">
        Replay of sample order {o.order_id}: the truck was due out at {hhmm(o.dispatch_planned_ts)} but had not left by the
        check at {hhmm(o.check_ts)}, so the risk score reached {o.risk_score} and an alert was sent.
      </p>
    </div>
  );
}

function SceneSkeleton() {
  return (
    <div className="grid items-end gap-6 sm:grid-cols-[1fr_auto]" aria-hidden="true">
      <div className="card h-[320px] animate-pulse bg-subtle sm:mr-[-56px] sm:mb-16" />
      <div className="mx-auto h-[597px] w-[276px] animate-pulse rounded-[48px] bg-subtle" />
    </div>
  );
}

/* ---------------- Route map ---------------- */

const VB = { w: 460, h: 132 };
const A = { x: 52, y: 92 }; // plant
const B = { x: 408, y: 44 }; // site
const ROUTE = `M ${A.x} ${A.y} C 140 92, 150 28, 240 46 S 340 96, ${B.x} ${B.y}`;
const at = (p: { x: number; y: number }) => ({ left: `${(p.x / VB.w) * 100}%`, top: `${(p.y / VB.h) * 100}%` });

function RouteMap(props: {
  plant: string;
  site: string;
  km: number;
  plannedOut: string;
  due: string;
  late: boolean;
  expected: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const p = pathRef.current;
    if (!p || props.expected <= 0) return setGhost(null);
    const pt = p.getPointAtLength(p.getTotalLength() * props.expected);
    setGhost({ x: pt.x, y: pt.y });
  }, [props.expected]);

  return (
    <div className="mt-4">
      <div className="relative overflow-hidden rounded-xl border border-border bg-subtle/60">
        <div className="blueprint absolute inset-0 opacity-60" aria-hidden="true" />
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="relative block h-auto w-full" aria-hidden="true">
          <path d={ROUTE} fill="none" className="stroke-border" strokeWidth="12" strokeLinecap="round" />
          <path ref={pathRef} d={ROUTE} fill="none" className="stroke-muted" strokeOpacity="0.55" strokeWidth="2" strokeDasharray="2 8" strokeLinecap="round" />
          {ghost && (
            <g transform={`translate(${ghost.x} ${ghost.y})`}>
              <circle r="10" className="fill-primary/15 stroke-primary" strokeWidth="1.5" strokeDasharray="3 3" />
              <circle r="3" className="fill-primary" />
            </g>
          )}
          <text x="240" y="122" textAnchor="middle" className="fill-muted" style={{ fontSize: 12 }}>
            {props.km} km by road
          </text>
        </svg>

        {/* Plant, with the truck still parked beside it */}
        <span
          className={`absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border bg-surface shadow-card ${
            props.late ? "border-status-late/70 text-status-late-ink" : "border-border text-ink"
          }`}
          style={at(A)}
          aria-hidden="true"
        >
          {props.late && <span className="absolute -inset-1 animate-ping rounded-xl border-2 border-status-late/40" />}
          <Factory className="h-[18px] w-[18px]" />
          <span className="absolute -bottom-2 -right-3 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface">
            <Truck className="h-3.5 w-3.5" />
          </span>
        </span>

        {/* Site */}
        <span
          className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-primary-ink shadow-card"
          style={at(B)}
          aria-hidden="true"
        >
          <MapPin className="h-[18px] w-[18px]" />
        </span>
      </div>

      <div className="mt-2.5 flex items-start justify-between gap-4 text-xs leading-snug">
        <div>
          <p className="font-semibold">{props.plant} plant</p>
          <p className={props.late ? "flex items-center gap-1 font-medium text-status-late-ink" : "text-muted"}>
            {props.late && <Clock aria-hidden="true" className="h-3 w-3" />}
            {props.late ? `Not dispatched, due out ${props.plannedOut}` : `Due out ${props.plannedOut}`}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{props.site}</p>
          <p className="text-muted">Needed at {props.due}</p>
        </div>
      </div>
      {props.expected > 0 && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-primary bg-primary/15" aria-hidden="true" />
          Where the truck should be by now
        </p>
      )}
    </div>
  );
}

/* ---------------- Score meter ---------------- */

function ScoreMeter({ score, reasons }: { score: number; reasons: { key: string; points: number; label: string }[] }) {
  const atRisk = score >= THRESHOLD;
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Delay-risk score</p>
        <p className="num text-sm tabular-nums">
          <span className="text-xl font-semibold">{score}</span>
          <span className="text-muted"> / 100</span>
        </p>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-subtle">
        <motion.div
          className={`h-full rounded-full ${atRisk ? "bg-status-risk" : "bg-primary"}`}
          animate={{ width: `${score}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
        />
        <span className="absolute -top-1 bottom-[-4px] w-px bg-ink/60" style={{ left: `${THRESHOLD}%` }} aria-hidden="true" />
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted">
        <span className="absolute -translate-x-1/2" style={{ left: `${THRESHOLD}%` }}>
          Alert at {THRESHOLD}
        </span>
      </div>
      <ul className="mt-2 flex min-h-[64px] flex-wrap content-start gap-1.5" aria-label="Reasons">
        <AnimatePresence initial={false}>
          {reasons.map((r) => (
            <motion.li
              key={r.key}
              layout
              initial={{ opacity: 0, scale: 0.85, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs"
            >
              <span className="num font-semibold text-primary-ink">+{r.points}</span>
              {r.label}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/* ---------------- Phone screen ---------------- */

function PhoneScreen({
  o,
  score,
  alerted,
  reasons,
}: {
  o: OrderRow;
  score: number;
  alerted: boolean;
  reasons: { key: string; sentence: string; points: number }[];
}) {
  return (
    <div className="flex h-full flex-col px-4 pb-6 pt-2 text-ink">
      <p className="text-xs text-muted">Today's deliveries</p>
      <p className="text-lg font-semibold leading-tight">{o.site_name}</p>

      <div className="mt-4 rounded-2xl border border-border bg-surface p-3.5 shadow-card">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug">{o.material}</p>
            <p className="text-xs text-muted">
              {o.qty_ordered} m³ from {o.vendor_name}
            </p>
          </div>
          <span
            className={`num flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums ${
              score >= THRESHOLD ? "border-status-risk text-status-risk-ink" : "border-border text-ink"
            }`}
            aria-label={`Risk ${score} of 100`}
          >
            {score}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <StatusChip status={score >= THRESHOLD ? "at-risk" : "on-track"} />
          <span className="text-xs text-muted">Due {hhmm(o.promised_ts)}</span>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-dashed border-border p-3 text-xs text-muted">
        Watching this order. You'll get an alert if it looks likely to be late.
      </div>

      <AnimatePresence>
        {alerted && (
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="absolute inset-x-0 bottom-0 z-10 rounded-t-[28px] border-t border-border bg-surface px-4 pb-7 pt-3 shadow-lift"
            role="status"
          >
            <span className="mx-auto block h-1 w-9 rounded-full bg-border" aria-hidden="true" />
            <div className="mt-3 flex items-center gap-2 text-status-risk-ink">
              <TriangleAlert aria-hidden="true" className="h-5 w-5" />
              <span className="text-sm font-semibold">At risk, score {score}</span>
            </div>
            <p className="mt-1 text-[19px] font-semibold leading-snug">Likely late by several hours</p>
            <ul className="mt-2 space-y-1.5">
              {reasons.slice(0, 3).map((r) => (
                <li key={r.key} className="flex gap-2 text-[12px] leading-snug text-ink">
                  <span className="num shrink-0 font-semibold text-primary-ink">+{r.points}</span>
                  <span>{r.sentence}</span>
                </li>
              ))}
              {reasons.length > 3 && <li className="pl-7 text-[12px] text-muted">and {reasons.length - 3} more reasons</li>}
            </ul>
            <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
              {[
                { icon: Phone, label: "Call vendor" },
                { icon: Repeat2, label: "Backup vendor" },
                { icon: CalendarClock, label: "Reschedule" },
              ].map(({ icon: Icon, label }, i) => (
                <span
                  key={label}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold ${
                    i === 0 ? "bg-primary text-primary-fg" : "bg-subtle text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
