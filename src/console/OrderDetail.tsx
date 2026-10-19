import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Check,
  Copy,
  Eye,
  Factory,
  MapPin,
  Phone,
  Repeat2,
  Route,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RiskBadge, StatusChip, useToast } from "../components/ui";
import { templateVendorMessage, vendorMessagePrompt } from "../lib/ask";
import { ALERT_AT, alertSent, earlyScore, fromMin, liveScore, liveStatus, ts, type LiveOrder } from "../lib/live";
import { backupVendor, dayMonth, hhmm, reasonsFor, unitLabel } from "../lib/orders";
import { useAi } from "../lib/useAi";
import { useConsole } from "./ConsoleContext";

const fmtWhen = (t: string) => `${dayMonth(t)}, ${hhmm(t)}`;

export function OrderDetail({ order: o, onClose, compact = false }: { order: LiveOrder; onClose?: () => void; compact?: boolean }) {
  const { now, orders, vendors } = useConsole();
  const status = liveStatus(o, now);
  const { score, full } = liveScore(o, now);
  const alerted = alertSent(o, now);
  const watching = !full && earlyScore(o) >= 25;
  const reasons = reasonsFor(o, full);
  const backup = useMemo(() => backupVendor(vendors, o.material_id, o.vendor_id), [vendors, o]);
  const qty = `${o.qty_ordered} ${unitLabel(o.unit)}`;

  // The vendor's last 10 deliveries before now, newest last.
  const last10 = useMemo(
    () =>
      orders
        .filter((x) => x.vendor_id === o.vendor_id && x.cancelled === 0 && x.delivered_ts && ts(x.delivered_ts) <= now)
        .sort((a, b) => ts(a.delivered_ts!) - ts(b.delivered_ts!))
        .slice(-10),
    [orders, o.vendor_id, now],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className={`flex items-start gap-3 border-b border-line ${compact ? "px-4 py-3" : "px-5 py-4"}`}>
        <div className="min-w-0 flex-1">
          <p className="num text-xs text-muted">{o.order_id}</p>
          <h2 className={`font-semibold tracking-[-0.01em] text-ink ${compact ? "text-base" : "text-lg"}`}>
            {o.material}, {qty}
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted">
            {o.site_name} from {o.vendor_name}
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <StatusChip status={status} size="md" />
          </div>
        </div>
        <RiskBadge score={score} status={status} size={compact ? 40 : 46} />
        {onClose && (
          <button onClick={onClose} className="-mr-1 rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Close order">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className={`scroll-thin min-h-0 flex-1 space-y-5 overflow-y-auto ${compact ? "p-4" : "p-5"}`}>
        {alerted && status !== "delivered" && status !== "delivered-late" && status !== "delivered-short" && (
          <AlertCard order={o} reasons={reasons.map((r) => r.sentence)} reasonPts={reasons} backupName={backup?.vendor_name} backupOtif={backup?.adjusted} />
        )}
        {watching && status === "watch" && (
          <div className="rounded-xl border border-watch/30 bg-watch/[0.06] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-watch">
              <Eye aria-hidden="true" className="h-4 w-4" />
              Keep an eye on this order
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Early warning signs add up to {earlyScore(o)} points. The full check runs at {fmtWhen(o.check_ts)}, an hour after the truck is due out.
            </p>
          </div>
        )}

        <Timeline o={o} now={now} />

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
          {[
            { k: "Promised", v: fmtWhen(o.promised_ts) },
            {
              k: "Arrived",
              v: o.delivered_ts && ts(o.delivered_ts) <= now ? fmtWhen(o.delivered_ts) : "Not yet",
              note:
                o.delivered_ts && ts(o.delivered_ts) <= now && (o.delay_hours ?? 0) > 0 ? `${o.delay_hours?.toFixed(1)} h late` : undefined,
            },
            { k: "Distance", v: `${Math.round(o.distance_km)} km` },
            { k: "Ordered", v: fmtWhen(o.order_ts) },
          ].map((f) => (
            <div key={f.k} className="bg-panel px-3.5 py-3">
              <dt className="text-xs text-muted">{f.k}</dt>
              <dd className="num mt-0.5 text-[13px] text-ink">
                {f.v}
                {f.note && <span className="ml-1.5 font-sans text-xs text-late">{f.note}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <ScoreBreakdown o={o} full={full} score={score} />

        <section aria-labelledby={`vend-${o.order_id}`}>
          <div className="flex items-baseline justify-between">
            <h3 id={`vend-${o.order_id}`} className="text-sm font-semibold">
              {o.vendor_name}, last {last10.length} deliveries
            </h3>
            <span className="text-xs text-muted">
              {last10.filter((x) => x.otif === 1).length} of {last10.length} on time and in full
            </span>
          </div>
          <ol className="mt-2.5 flex gap-1.5">
            {last10.map((x) => {
              const ok = x.otif === 1;
              return (
                <li
                  key={x.order_id}
                  title={`${x.order_id}: ${ok ? "on time and in full" : x.on_time === 0 ? "late" : "short"}`}
                  className={`flex h-7 flex-1 items-center justify-center rounded-md border ${
                    ok ? "border-good/30 bg-good/10 text-good" : "border-late/30 bg-late/10 text-late"
                  }`}
                >
                  {ok ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <X aria-hidden="true" className="h-3.5 w-3.5" />}
                  <span className="sr-only">{ok ? "On time and in full" : "Late or short"}</span>
                </li>
              );
            })}
            {last10.length === 0 && <li className="text-sm text-muted">No deliveries yet.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}

/* ---------------- Alert ---------------- */

function AlertCard({
  order: o,
  reasonPts,
  backupName,
  backupOtif,
}: {
  order: LiveOrder;
  reasons: string[];
  reasonPts: { key: string; points: number; sentence: string }[];
  backupName?: string;
  backupOtif?: number;
}) {
  const toast = useToast();
  const { ai } = useAi();
  const [draft, setDraft] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);
  const facts = {
    vendor: o.vendor_name,
    material: o.material,
    qty: `${o.qty_ordered} ${unitLabel(o.unit)}`,
    site: o.site_name,
    due: fmtWhen(o.promised_ts),
    plannedOut: hhmm(o.dispatch_planned_ts),
  };

  const makeDraft = async () => {
    if (!ai) {
      setDraft(templateVendorMessage(facts));
      return;
    }
    setDrafting(true);
    setDraft("");
    try {
      const text = await ai.text(vendorMessagePrompt({ ...facts, reasons: reasonPts.map((r) => r.sentence) }), {
        quick: true,
        onText: (t) => setDraft(t),
      });
      setDraft(text.trim());
    } catch {
      setDraft(templateVendorMessage(facts));
    } finally {
      setDrafting(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby={`alert-${o.order_id}`}
      className="overflow-hidden rounded-xl border border-risk/35 bg-risk/[0.05]"
    >
      <div className="p-4">
        <p className="flex items-center gap-2 text-[13px] font-medium text-risk">
          <TriangleAlert aria-hidden="true" className="h-4 w-4" />
          Alert sent at {hhmm(o.check_ts)}, {o.alert_lead_hours?.toFixed(1)} h before the promised time
        </p>
        <h3 id={`alert-${o.order_id}`} className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-ink">
          Likely late by several hours
        </h3>
        <ul className="mt-3 space-y-2">
          {reasonPts.map((r) => (
            <li key={r.key} className="flex gap-3 text-sm leading-snug text-ink-2">
              <span className="num w-8 shrink-0 text-right font-semibold text-risk">+{r.points}</span>
              {r.sentence}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-3 gap-px border-t border-risk/20 bg-risk/20">
        {[
          { icon: Phone, label: "Call vendor", done: `Calling ${o.vendor_name} dispatch` },
          {
            icon: Repeat2,
            label: "Switch to backup",
            done: backupName ? `Backup request sent to ${backupName}` : "No backup vendor for this material",
          },
          { icon: CalendarClock, label: "Reschedule work", done: "Crew moved to other work for today" },
        ].map(({ icon: Icon, label, done }) => (
          <button
            key={label}
            onClick={() => toast(done)}
            className="flex flex-col items-center gap-1.5 bg-panel px-2 py-3 text-xs font-medium text-ink transition-colors hover:bg-raised sm:flex-row sm:justify-center sm:text-[13px]"
          >
            <Icon aria-hidden="true" className="h-4 w-4 text-primary-ink" />
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-3 border-t border-risk/20 bg-panel p-4">
        {backupName && (
          <p className="flex items-center gap-2 text-sm text-ink-2">
            <Repeat2 aria-hidden="true" className="h-4 w-4 text-muted" />
            Backup: <span className="font-medium text-ink">{backupName}</span>
            <span className="text-muted">adjusted OTIF {((backupOtif ?? 0) * 100).toFixed(1)}%</span>
          </p>
        )}
        <AnimatePresence initial={false}>
          {draft !== null ? (
            <motion.div key="draft" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
              <label htmlFor={`draft-${o.order_id}`} className="text-xs text-muted">
                Message to {o.vendor_name} {ai ? `(drafted by ${ai.label})` : "(template)"}
              </label>
              <textarea
                id={`draft-${o.order_id}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                className="input mt-1.5 resize-none py-2.5 leading-relaxed"
                placeholder={drafting ? "Writing…" : ""}
              />
              <button
                onClick={() =>
                  navigator.clipboard?.writeText(draft).then(
                    () => {
                      setCopied(true);
                      toast("Message copied");
                      setTimeout(() => setCopied(false), 1500);
                    },
                    () => {},
                  )
                }
                disabled={drafting || !draft}
                className="btn-secondary mt-2 min-h-[34px] px-3 text-[13px]"
              >
                {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
                Copy message
              </button>
            </motion.div>
          ) : (
            <button onClick={makeDraft} className="btn-secondary min-h-[34px] px-3 text-[13px]">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary-ink" />
              {ai ? "Draft a message to the vendor" : "Prepare a message to the vendor"}
            </button>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

/* ---------------- Timeline ---------------- */

function Timeline({ o, now }: { o: LiveOrder; now: number }) {
  const planned = ts(o.dispatch_planned_ts);
  const out = o.dispatch_actual_ts ? ts(o.dispatch_actual_ts) : null;
  const delivered = o.delivered_ts ? ts(o.delivered_ts) : null;
  const isOut = out !== null && now >= out;
  const isIn = delivered !== null && now >= delivered;
  const lateOut = !isOut && now > planned;

  const steps = [
    { label: "Ordered", done: true, detail: fmtWhen(o.order_ts), icon: Check },
    { label: "Vendor confirmed", done: true, detail: o.vendor_name, icon: Check },
    {
      label: "Dispatched",
      done: isOut,
      warn: lateOut || (isOut && out! > planned + 60),
      detail: isOut
        ? `Left ${hhmm(o.dispatch_actual_ts)}, planned ${hhmm(o.dispatch_planned_ts)}`
        : lateOut
          ? `Not out yet. Planned ${hhmm(o.dispatch_planned_ts)}`
          : `Planned ${fmtWhen(o.dispatch_planned_ts)}`,
      icon: Factory,
    },
    {
      label: "In transit",
      done: isOut,
      detail: isOut ? (isIn ? `${Math.round(o.distance_km)} km` : `${Math.round(o.distance_km)} km route, on the road`) : `${Math.round(o.distance_km)} km route`,
      icon: Route,
    },
    {
      label: "Delivered",
      done: isIn,
      warn: isIn && o.on_time === 0,
      detail: isIn ? `${hhmm(o.delivered_ts)}, promised ${hhmm(o.promised_ts)}` : `Promised ${fmtWhen(o.promised_ts)}`,
      icon: MapPin,
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <ol aria-label="Order timeline" className="relative space-y-0">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isCurrent = i === current;
        return (
          <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute left-[13px] top-7 h-[calc(100%-24px)] w-px ${steps[i + 1].done ? "bg-primary-ink/50" : "bg-line-strong"}`}
              />
            )}
            <span
              className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                s.warn
                  ? "border-late/50 bg-late/10 text-late"
                  : s.done
                    ? "border-primary-ink/40 bg-primary/15 text-primary-ink"
                    : isCurrent
                      ? "border-line-strong bg-raised text-ink-2"
                      : "border-line bg-panel text-muted"
              }`}
            >
              {isCurrent && !s.warn && <span className="absolute inset-0 animate-ping rounded-full border border-primary-ink/30" aria-hidden="true" />}
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm font-medium ${s.done || isCurrent ? "text-ink" : "text-muted"}`}>
                {s.label}
                <span className="sr-only">{s.done ? ", done" : isCurrent ? ", next" : ", pending"}</span>
              </p>
              <p className={`num text-xs ${s.warn ? "text-late" : "text-muted"}`}>{s.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Score breakdown ---------------- */

function ScoreBreakdown({ o, full, score }: { o: LiveOrder; full: boolean; score: number }) {
  const rules = [
    { pts: o.pts_dispatch_late, max: 40, text: "Truck not out an hour after planned dispatch", pending: !full },
    { pts: o.pts_vendor_recent_otif_below_80, max: 25, text: "Vendor under 80% on its last 10 orders" },
    { pts: o.pts_distance_over_50km, max: 15, text: "Route longer than 50 km" },
    { pts: o.pts_ordered_under_24h, max: 10, text: "Ordered under 24 hours before needed" },
    { pts: o.pts_monsoon, max: 10, text: "Monsoon season" },
  ];
  return (
    <section aria-labelledby={`score-${o.order_id}`}>
      <div className="flex items-baseline justify-between">
        <h3 id={`score-${o.order_id}`} className="text-sm font-semibold">
          Why the score is {score}
        </h3>
        <span className="text-xs text-muted">{full ? `Alert at ${ALERT_AT}` : "Early score, before the check"}</span>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-raised">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${score >= ALERT_AT ? "bg-risk" : "bg-primary-ink"}`}
          style={{ width: `${score}%` }}
        />
        <span className="absolute -top-1 h-4 w-px bg-ink-2" style={{ left: `${ALERT_AT}%` }} aria-hidden="true" />
      </div>
      <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
        {rules.map((r) => {
          const earned = r.pending ? 0 : r.pts;
          return (
            <li key={r.text} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
              <span className={`num w-9 shrink-0 font-semibold ${earned > 0 ? "text-ink" : "text-muted"}`}>+{earned}</span>
              <span className={earned > 0 ? "text-ink-2" : "text-muted"}>{r.text}</span>
              <span className="num ml-auto shrink-0 text-xs text-muted">
                {r.pending ? `at ${hhmm(fromMin(ts(o.check_ts)))}` : `of ${r.max}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
