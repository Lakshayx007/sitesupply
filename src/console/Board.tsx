import { AnimatePresence, motion } from "framer-motion";
import { Inbox, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { RiskBadge, Spinner, StatusChip, statusLabel } from "../components/ui";
import { STATUS_RANK, isDelivered, isPlaced, liveScore, liveStatus, ts, type LiveOrder, type LiveStatus } from "../lib/live";
import { dayMonth, hhmm, unitLabel } from "../lib/orders";
import { useConsole } from "./ConsoleContext";
import { OrderDetail } from "./OrderDetail";

const FILTERS: { key: "all" | LiveStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "delayed", label: "Delayed" },
  { key: "at-risk", label: "At risk" },
  { key: "watch", label: "Watch" },
  { key: "on-track", label: "On track" },
];

const DAY = 24 * 60;

export function Board() {
  const { now, orders, byId, loading } = useConsole();
  const { id } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | LiveStatus>("all");
  const [material, setMaterial] = useState("all");
  const [query, setQuery] = useState("");
  const selected = id ? byId.get(id) : undefined;

  // On the board: everything placed and not yet delivered, plus deliveries from the last 24 hours.
  const rows = useMemo(() => {
    return orders
      .filter((o) => isPlaced(o, now) && (!isDelivered(o, now) || now - ts(o.delivered_ts!) < DAY))
      .map((o) => ({ o, status: liveStatus(o, now), score: liveScore(o, now).score }))
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || ts(a.o.promised_ts) - ts(b.o.promised_ts));
  }, [orders, now]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const week = useMemo(() => {
    const d = orders.filter((o) => o.delivered_ts && o.cancelled === 0 && ts(o.delivered_ts) <= now && now - ts(o.delivered_ts) < 7 * DAY);
    return { n: d.length, otif: d.length ? d.reduce((a, o) => a + (o.otif ?? 0), 0) / d.length : null };
  }, [orders, now]);

  const materials = useMemo(() => [...new Set(orders.map((o) => o.material))].sort(), [orders]);

  const shown = rows.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      (material === "all" || r.o.material === material) &&
      (!query ||
        `${r.o.order_id} ${r.o.site_name} ${r.o.vendor_name} ${r.o.material}`.toLowerCase().includes(query.toLowerCase())),
  );

  const open = rows.filter((r) => !r.status.startsWith("delivered")).length;

  if (loading) return <div className="p-6"><Spinner label="Loading orders" /></div>;

  return (
    <div className="flex h-full min-h-0">
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${selected ? "hidden md:flex" : "flex"}`}>
        {/* Summary */}
        <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-5">
          {[
            { k: "Open orders", v: open },
            { k: "Delayed", v: counts.delayed ?? 0, tone: (counts.delayed ?? 0) > 0 ? "text-late" : "" },
            { k: "At risk", v: counts["at-risk"] ?? 0, tone: (counts["at-risk"] ?? 0) > 0 ? "text-risk" : "" },
            { k: "Watch", v: counts.watch ?? 0 },
            { k: "OTIF, last 7 days", v: week.otif === null ? "–" : `${(week.otif * 100).toFixed(0)}%`, note: `of ${week.n}` },
          ].map((s, i) => (
            <div key={s.k} className={`bg-canvas px-4 py-3 lg:px-6 ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
              <dt className="text-xs text-muted">{s.k}</dt>
              <dd className={`num mt-0.5 text-xl font-semibold ${s.tone || "text-ink"}`}>
                {s.v}
                {s.note && <span className="ml-2 font-sans text-xs font-normal text-muted">{s.note}</span>}
              </dd>
            </div>
          ))}
        </dl>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 lg:px-6">
          <div role="group" aria-label="Filter by status" className="scroll-thin flex max-w-full gap-1 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs ${
                  filter === f.key ? "bg-raised text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {f.label}
                {f.key !== "all" && <span className="num ml-1.5 text-muted">{counts[f.key] ?? 0}</span>}
              </button>
            ))}
          </div>
          <div className="ml-auto flex w-full gap-2 sm:w-auto">
            <label htmlFor="material" className="sr-only">
              Material
            </label>
            <select id="material" value={material} onChange={(e) => setMaterial(e.target.value)} className="input min-h-[34px] w-auto flex-1 py-1 text-xs sm:flex-none">
              <option value="all">All materials</option>
              {materials.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <div className="relative flex-1 sm:w-52 sm:flex-none">
              <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
              <label htmlFor="q" className="sr-only">
                Search orders
              </label>
              <input id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search site, vendor, order" className="input min-h-[34px] py-1 pl-8 text-xs" />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <Inbox aria-hidden="true" className="h-6 w-6 text-muted" />
              <p className="text-sm text-ink">No orders match</p>
              <p className="text-xs text-muted">Change the filters or move the replay clock.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Orders at the replay time, most urgent first</caption>
              <thead className="sticky top-0 z-10 hidden bg-canvas/95 text-xs text-muted backdrop-blur md:table-header-group">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pl-6 pr-3 font-medium">Order</th>
                  <th scope="col" className="px-3 py-2 font-medium">Site</th>
                  <th scope="col" className="hidden px-3 py-2 font-medium xl:table-cell">Vendor</th>
                  <th scope="col" className="px-3 py-2 font-medium">Due</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="py-2 pl-3 pr-6 text-right font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {shown.map(({ o, status, score }) => (
                    <Row key={o.order_id} o={o} status={status} score={score} active={o.order_id === id} onOpen={() => navigate(`/console/order/${o.order_id}`)} />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <aside
          aria-label={`Order ${selected.order_id}`}
          className="flex min-h-0 w-full flex-col border-l border-line bg-panel md:w-[420px] md:shrink-0 xl:w-[460px]"
        >
          <OrderDetail key={selected.order_id} order={selected} onClose={() => navigate("/console")} />
        </aside>
      ) : (
        <div className="hidden w-[420px] shrink-0 flex-col items-center justify-center gap-2 border-l border-line bg-panel px-8 text-center xl:flex xl:w-[460px]">
          <p className="text-sm text-ink">Select an order</p>
          <p className="text-xs text-muted">See its timeline, the vendor's record and why it scored what it did.</p>
        </div>
      )}
    </div>
  );
}

function Row({ o, status, score, active, onOpen }: { o: LiveOrder; status: LiveStatus; score: number; active: boolean; onOpen: () => void }) {
  return (
    <motion.tr
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onOpen}
      className={`group cursor-pointer border-b border-line transition-colors ${active ? "bg-raised" : "hover:bg-panel"}`}
    >
      <td className="py-3 pl-4 pr-3 md:pl-6">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="block min-w-0 text-left"
          aria-label={`${o.material}, ${o.order_id}, ${statusLabel(status)}, risk ${score}`}
        >
          <span className="block truncate font-medium text-ink">{o.material}</span>
          <span className="num block text-xs text-muted">
            {o.order_id}, {o.qty_ordered} {unitLabel(o.unit)}
          </span>
        </button>
        {/* compact meta on phones */}
        <span className="mt-1.5 flex items-center gap-2 md:hidden">
          <StatusChip status={status} />
          <span className="truncate text-xs text-muted">{o.site_name.replace(/ \(.*\)/, "")}</span>
        </span>
      </td>
      <td className="hidden px-3 py-3 md:table-cell">
        <span className="block truncate text-ink-2">{o.site_name.replace(/ \(.*\)/, "")}</span>
        <span className="block text-xs text-muted xl:hidden">{o.vendor_name}</span>
      </td>
      <td className="hidden px-3 py-3 text-ink-2 xl:table-cell">{o.vendor_name}</td>
      <td className="num hidden whitespace-nowrap px-3 py-3 text-[13px] text-ink-2 md:table-cell">
        {dayMonth(o.promised_ts)} <span className="text-muted">{hhmm(o.promised_ts)}</span>
      </td>
      <td className="hidden px-3 py-3 md:table-cell">
        <StatusChip status={status} />
      </td>
      <td className="py-3 pl-3 pr-4 text-right md:pr-6">
        <RiskBadge score={score} status={status} />
      </td>
    </motion.tr>
  );
}
