import { BellOff, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AskPanel } from "../components/ask/AskPanel";
import { PhoneFrame } from "../components/PhoneFrame";
import { RiskBadge, StatusChip } from "../components/ui";
import { alertSent, isPlaced, liveScore, liveStatus, ts, type LiveOrder } from "../lib/live";
import { dayMonth, hhmm, reasonsFor, unitLabel } from "../lib/orders";
import { useConsole } from "./ConsoleContext";
import { fmtClock } from "./ConsoleLayout";
import { OrderDetail } from "./OrderDetail";

const DAY = 24 * 60;

/* ---------------- Alerts feed ---------------- */

export function AlertsView() {
  const { orders, now } = useConsole();
  const alerts = useMemo(
    () =>
      orders
        .filter((o) => o.cancelled === 0 && alertSent(o, now) && now - ts(o.check_ts) < 7 * DAY)
        .sort((a, b) => ts(b.check_ts) - ts(a.check_ts)),
    [orders, now],
  );
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Alerts, last 7 days</h1>
        <p className="mt-1 text-sm text-muted">Sent at the dispatch check when an order scores 50 or more. Newest first.</p>
        {alerts.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-2 text-center">
            <BellOff aria-hidden="true" className="h-6 w-6 text-muted" />
            <p className="text-sm">No alerts in the last 7 days of the replay.</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {alerts.map((o) => {
              const status = liveStatus(o, now);
              const reasons = reasonsFor(o);
              const age = now - ts(o.check_ts);
              return (
                <li key={o.order_id}>
                  <Link to={`/console/order/${o.order_id}`} className="group flex gap-3 rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong hover:bg-raised">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-medium text-ink">
                          {o.material}, {o.qty_ordered} {unitLabel(o.unit)}
                        </p>
                        <StatusChip status={status} />
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {o.site_name} from {o.vendor_name}, due {dayMonth(o.promised_ts)} {hhmm(o.promised_ts)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-ink-2">{reasons.map((r) => r.sentence).join(" ")}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="num text-xs text-muted">{age < 60 ? `${age} min ago` : age < DAY ? `${Math.floor(age / 60)} h ago` : `${Math.floor(age / DAY)} d ago`}</span>
                      <RiskBadge score={o.risk_score} status={status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Site engineer view (phone) ---------------- */

export function SiteView() {
  const { orders, now } = useConsole();
  // The demo customer is the one with the most orders (CLAUDE.md).
  const sites = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number }>();
    for (const o of orders) {
      if (o.cancelled) continue;
      const s = m.get(o.customer_id) ?? { id: o.customer_id, name: o.site_name, n: 0 };
      s.n++;
      m.set(o.customer_id, s);
    }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  }, [orders]);
  const [site, setSite] = useState<string | null>(null);
  const current = site ?? sites[0]?.id;
  const info = sites.find((s) => s.id === current);
  const [open, setOpen] = useState<LiveOrder | null>(null);

  const list = useMemo(
    () =>
      orders
        .filter((o) => o.customer_id === current && isPlaced(o, now))
        .sort((a, b) => ts(b.promised_ts) - ts(a.promised_ts)),
    [orders, current, now],
  );
  const upcoming = list.filter((o) => !liveStatus(o, now).startsWith("delivered"));
  const past = list.filter((o) => liveStatus(o, now).startsWith("delivered"));
  const { time } = fmtClock(now);

  const screen = open ? (
    <div className="flex h-full flex-col bg-panel">
      <button onClick={() => setOpen(null)} className="flex items-center gap-1 px-3 py-2 text-sm text-primary-ink">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Deliveries
      </button>
      <div className="min-h-0 flex-1">
        <OrderDetail order={open} compact />
      </div>
    </div>
  ) : (
    <div className="scroll-thin h-full overflow-y-auto bg-canvas px-4 pb-8 pt-2">
      <p className="text-xs text-muted">Deliveries</p>
      <p className="text-lg font-semibold leading-tight">{info?.name}</p>
      <Section title="Coming up" empty="Nothing on the way right now.">
        {upcoming.map((o) => (
          <PhoneRow key={o.order_id} o={o} now={now} onOpen={() => setOpen(o)} />
        ))}
      </Section>
      <Section title="Delivered" empty="No deliveries yet.">
        {past.slice(0, 8).map((o) => (
          <PhoneRow key={o.order_id} o={o} now={now} onOpen={() => setOpen(o)} />
        ))}
      </Section>
    </div>
  );

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 lg:flex-row lg:items-start lg:px-6">
        <div className="lg:w-72 lg:shrink-0">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Site engineer view</h1>
          <p className="mt-1 text-sm text-muted">
            What the person on site sees on their phone. It opens on {sites[0]?.name}, the site with the most orders ({sites[0]?.n}).
          </p>
          <label htmlFor="site" className="mt-5 block text-xs text-muted">
            Site
          </label>
          <select
            id="site"
            value={current}
            onChange={(e) => {
              setSite(e.target.value);
              setOpen(null);
            }}
            className="input mt-1.5"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.n} orders)
              </option>
            ))}
          </select>
          <p className="mt-4 text-xs text-muted">Move the replay clock above to watch orders change status and alerts arrive.</p>
        </div>
        <div className="flex justify-center lg:flex-1">
          <div className="hidden sm:block">
            <PhoneFrame width={390} time={time} label="Site engineer's phone">
              {screen}
            </PhoneFrame>
          </div>
          <div className="w-full overflow-hidden rounded-2xl border border-line sm:hidden" style={{ height: 640 }}>
            {screen}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-xs font-medium text-muted">{title}</h2>
      {children.length ? <ul className="space-y-2">{children}</ul> : <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">{empty}</p>}
    </section>
  );
}

function PhoneRow({ o, now, onOpen }: { o: LiveOrder; now: number; onOpen: () => void }) {
  const status = liveStatus(o, now);
  const { score } = liveScore(o, now);
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 rounded-xl border border-line bg-panel p-3 text-left hover:bg-raised">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{o.material}</p>
          <p className="truncate text-xs text-muted">
            {o.qty_ordered} {unitLabel(o.unit)} from {o.vendor_name}, due {dayMonth(o.promised_ts)} {hhmm(o.promised_ts)}
          </p>
          <span className="mt-2 inline-flex">
            <StatusChip status={status} />
          </span>
        </div>
        <RiskBadge score={score} status={status} />
        <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted" />
      </button>
    </li>
  );
}

/* ---------------- Ask ---------------- */

export function AskView() {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-6 lg:px-6">
      <h1 className="text-xl font-semibold tracking-[-0.02em]">Ask SiteSupply</h1>
      <p className="mt-1 text-sm text-muted">Ask about vendors, delays, materials or alerts. Each answer shows the query it ran and the rows it read.</p>
      <div className="mt-4 min-h-0 flex-1">
        <AskPanel />
      </div>
    </div>
  );
}
