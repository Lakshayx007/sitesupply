import { ArrowDown, ArrowUp, ArrowUpDown, Info, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard } from "../components/charts/ChartCard";
import { base, tok } from "../components/charts/echarts";
import { useQuery } from "../db/useQuery";
import { dayMonth } from "../lib/orders";
import { shrink, wilson } from "../lib/stats";

const K = 20; // prior strength: "20 orders' worth" of the average vendor
const WEAK = 0.65;

const Q = {
  vendors: `SELECT o.vendor_id, v.vendor_name, v.materials, COUNT(*) AS n, SUM(o.otif) AS s, ROUND(AVG(o.otif), 3) AS otif,
       ROUND(AVG(CASE WHEN o.delay_hours > 0 THEN o.delay_hours END), 1) AS avg_delay_h, v.price_index, v.joined
FROM orders o JOIN vendors v USING (vendor_id)
WHERE o.cancelled = 0 GROUP BY o.vendor_id ORDER BY otif`,
  overall: `SELECT AVG(otif) AS pbar FROM orders WHERE cancelled = 0`,
  materials: `SELECT material_id, material FROM materials`,
};

interface Row {
  vendor_id: string;
  vendor_name: string;
  materials: string;
  n: number;
  s: number;
  otif: number;
  avg_delay_h: number;
  price_index: number;
  joined: string;
}

type SortKey = "vendor_name" | "n" | "otif" | "range" | "adjusted" | "avg_delay_h" | "price_index";

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;

export function Vendors() {
  const rows = useQuery<Row>(Q.vendors).rows;
  const pbar = useQuery<{ pbar: number }>(Q.overall).rows[0]?.pbar ?? 0.7;
  const mats = useQuery<{ material_id: string; material: string }>(Q.materials).rows;
  const matName = useMemo(() => Object.fromEntries(mats.map((m) => [m.material_id, m.material])), [mats]);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "adjusted", dir: -1 });

  const data = useMemo(
    () =>
      rows.map((r) => {
        const [lo, hi] = wilson(r.s, r.n);
        return { ...r, lo, hi, width: hi - lo, adjusted: shrink(r.s, r.n, pbar, K) };
      }),
    [rows, pbar],
  );

  const sorted = useMemo(() => {
    const val = (d: (typeof data)[number]) => (sort.key === "range" ? d.width : d[sort.key]);
    return [...data].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number)) * sort.dir;
    });
  }, [data, sort]);

  const B = useMemo(() => base(), []);

  const byAdj = useMemo(() => [...data].sort((a, b) => a.adjusted - b.adjusted), [data]);

  const rangeOpt = useMemo(() => {
    if (!byAdj.length) return null;
    const names = byAdj.map((d) => d.vendor_name);
    return {
      ...B,
      legend: { show: true, top: 0, right: 0, textStyle: { color: B.muted, fontSize: 11 }, itemWidth: 10, itemHeight: 10, data: ["Raw OTIF", "Adjusted OTIF"] },
      grid: { ...B.grid, top: 32 },
      tooltip: {
        ...B.tooltip,
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        formatter: (ps: { dataIndex: number }[]) => {
          const d = byAdj[ps[0].dataIndex];
          return `<b>${d.vendor_name}</b>, ${d.n} orders<br/>Raw ${pct(d.otif)}<br/>95% range ${pct(d.lo)} to ${pct(d.hi)}<br/>Adjusted ${pct(d.adjusted)}`;
        },
      },
      xAxis: { type: "value", min: 0.4, max: 0.9, ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => `${Math.round(v * 100)}%` } },
      yAxis: { type: "category", data: names, ...B.axisCommon, splitLine: { show: false }, axisLabel: { ...B.axisCommon.axisLabel, color: tok("ink-2") } },
      series: [
        {
          name: "95% range",
          type: "custom",
          data: byAdj.map((d, i) => [d.lo, d.hi, i]),
          renderItem: (_: unknown, api: { value: (i: number) => number; coord: (p: [number, number]) => [number, number] }) => {
            const a = api.coord([api.value(0), api.value(2)]);
            const b = api.coord([api.value(1), api.value(2)]);
            return { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: tok("line-strong"), lineWidth: 6, lineCap: "round" } };
          },
          z: 1,
        },
        {
          name: "Raw OTIF",
          type: "scatter",
          data: byAdj.map((d) => d.otif),
          symbolSize: 9,
          itemStyle: { color: tok("canvas"), borderColor: B.series2, borderWidth: 1.5 },
          z: 2,
        },
        {
          name: "Adjusted OTIF",
          type: "scatter",
          data: byAdj.map((d) => d.adjusted),
          symbolSize: 10,
          itemStyle: { color: B.series1 },
          z: 3,
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: B.series2, type: "dashed", width: 1 },
            label: { formatter: `All vendors ${pct(pbar)}`, color: B.muted, fontSize: 11 },
            data: [{ xAxis: pbar }],
          },
        },
      ],
    };
  }, [B, byAdj, pbar]);

  const priceOpt = useMemo(() => {
    if (!data.length) return null;
    return {
      ...B,
      tooltip: {
        ...B.tooltip,
        trigger: "item" as const,
        formatter: (p: { data: [number, number, string] }) => `<b>${p.data[2]}</b><br/>Price index ${p.data[0].toFixed(3)}<br/>Adjusted OTIF ${pct(p.data[1])}`,
      },
      grid: { ...B.grid, bottom: 28, left: 12 },
      xAxis: { type: "value", min: 0.93, max: 1.07, name: "price index (1.00 = average)", nameLocation: "middle", nameGap: 28, ...B.axisCommon, splitLine: { show: false } },
      yAxis: { type: "value", min: 0.5, max: 0.85, ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => `${Math.round(v * 100)}%` } },
      series: [
        {
          type: "scatter",
          data: data.map((d) => [d.price_index, d.adjusted, d.vendor_name]),
          symbolSize: (v: [number, number, string]) => 8 + Math.sqrt(data.find((d) => d.vendor_name === v[2])!.n) * 0.9,
          itemStyle: { color: tok("primary-ink", 0.75), borderColor: B.series1 },
          label: { show: true, position: "right", color: B.muted, fontSize: 10, formatter: (p: { data: [number, number, string] }) => p.data[2].replace("Vendor ", "") },
          labelLayout: { moveOverlap: "shiftY" },
        },
      ],
    };
  }, [B, data]);

  const L = data.find((d) => d.vendor_id === "VL");
  const G = data.find((d) => d.vendor_id === "VG");
  const weak = data.filter((d) => d.adjusted < WEAK);
  const weakShare = data.length ? weak.reduce((a, d) => a + d.n, 0) / data.reduce((a, d) => a + d.n, 0) : 0;

  const header = (key: SortKey, label: string, align = "text-right") => {
    const active = sort.key === key;
    const Icon = active ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`whitespace-nowrap px-3 py-2 font-medium ${align}`}>
        <button
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : key === "vendor_name" ? 1 : -1 }))}
          className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
        >
          {label}
          <Icon aria-hidden="true" className="h-3 w-3" />
        </button>
      </th>
    );
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1280px] space-y-4 px-4 py-6 lg:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Vendors</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            How reliably each vendor delivers on time and in full, with an honest range for vendors with few orders.
            {weak.length > 0 && ` ${weak.map((w) => w.vendor_name).join(" and ")} handle ${pct(weakShare, 0)} of orders and score below ${pct(WEAK, 0)}.`}
          </p>
        </div>

        <section aria-labelledby="scorecard" className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 id="scorecard" className="text-[15px] font-semibold">Scorecard</h2>
            <p className="text-xs text-muted">Click a column to sort</p>
          </div>
          <div className="scroll-thin mt-3 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-y border-line bg-raised/50 text-xs text-muted">
                <tr>
                  {header("vendor_name", "Vendor", "text-left pl-5")}
                  <th scope="col" className="px-3 py-2 font-medium">Materials</th>
                  {header("n", "Orders")}
                  {header("otif", "Raw OTIF")}
                  {header("range", "95% range")}
                  {header("adjusted", "Adjusted OTIF")}
                  {header("avg_delay_h", "Avg delay when late")}
                  {header("price_index", "Price index")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => {
                  const isWeak = d.adjusted < WEAK;
                  return (
                    <tr key={d.vendor_id} className="border-b border-line last:border-0 hover:bg-raised/40">
                      <th scope="row" className="whitespace-nowrap py-2.5 pl-5 pr-3 text-left font-medium">
                        <span className="flex items-center gap-2">
                          {d.vendor_name}
                          {isWeak && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-risk/35 bg-risk/10 px-1.5 py-0.5 text-[11px] text-risk">
                              <TriangleAlert aria-hidden="true" className="h-3 w-3" />
                              Unreliable
                            </span>
                          )}
                          {d.joined > "2026-04-06" && (
                            <span className="rounded-full border border-line px-1.5 py-0.5 text-[11px] text-muted">Joined {dayMonth(d.joined)}</span>
                          )}
                        </span>
                      </th>
                      <td className="px-3 py-2.5 text-xs text-muted">{d.materials.split("|").map((m) => matName[m] ?? m).join(", ")}</td>
                      <td className="num px-3 py-2.5 text-right text-ink-2">{d.n}</td>
                      <td className="num px-3 py-2.5 text-right text-ink-2">{pct(d.otif)}</td>
                      <td className="num whitespace-nowrap px-3 py-2.5 text-right text-muted">
                        {pct(d.lo, 0)} to {pct(d.hi, 0)}
                      </td>
                      <td className={`num px-3 py-2.5 text-right font-semibold ${isWeak ? "text-risk" : "text-ink"}`}>{pct(d.adjusted)}</td>
                      <td className="num px-3 py-2.5 text-right text-ink-2">{d.avg_delay_h.toFixed(1)} h</td>
                      <td className="num px-3 py-2.5 pr-5 text-right text-ink-2">{d.price_index.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <ChartCard
            title="Reliability with its range"
            subtitle="Hollow dot: raw OTIF. Filled dot: adjusted. Bar: 95% Wilson range. Fewer orders, wider bar."
            option={rangeOpt}
            height={420}
            queries={[
              { label: "Orders and on-time-in-full count per vendor", sql: Q.vendors },
              { label: "The all-vendor average used for the adjustment", sql: Q.overall },
            ]}
            table={{
              head: ["Vendor", "Orders", "Raw", "95% range", "Adjusted"],
              rows: byAdj.map((d) => [d.vendor_name, d.n, pct(d.otif), `${pct(d.lo)} to ${pct(d.hi)}`, pct(d.adjusted)]),
            }}
          />
          <div className="flex flex-col gap-4">
            <section aria-labelledby="why-adjusted" className="panel p-5">
              <h2 id="why-adjusted" className="flex items-center gap-2 text-[15px] font-semibold">
                <Info aria-hidden="true" className="h-4 w-4 text-primary-ink" />
                Why adjusted?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                A vendor with three lucky orders shouldn't top the list. So every vendor's record gets {K} orders' worth of the
                all-vendor average ({pct(pbar)}) mixed in. Vendors with lots of orders barely move; new ones are pulled toward the
                middle until they prove themselves.
              </p>
              <ShrinkPlayground data={data} pbar={pbar} />
              {L && G && (
                <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm text-ink-2">
                  <li>
                    <span className="font-medium text-ink">{L.vendor_name}</span>: {pct(L.otif)} on only {L.n} orders. The true rate could be
                    anywhere from {pct(L.lo, 0)} to {pct(L.hi, 0)}, so it becomes {pct(L.adjusted)}.
                  </li>
                  <li>
                    <span className="font-medium text-ink">{G.vendor_name}</span>: {pct(G.otif)} on {G.n} orders hardly moves, to {pct(G.adjusted)}.
                  </li>
                </ul>
              )}
            </section>
            <ChartCard
              title="Cheaper is not more reliable"
              subtitle="Price index against adjusted OTIF. Dot size is order volume."
              option={priceOpt}
              height={250}
              queries={[{ sql: Q.vendors }]}
              table={{
                head: ["Vendor", "Price index", "Adjusted OTIF", "Orders"],
                rows: [...data].sort((a, b) => a.price_index - b.price_index).map((d) => [d.vendor_name, d.price_index.toFixed(3), pct(d.adjusted), d.n]),
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Drag the prior strength and watch a vendor's adjusted score move toward the all-vendor average. */
function ShrinkPlayground({ data, pbar }: { data: { vendor_id: string; vendor_name: string; n: number; s: number; otif: number }[]; pbar: number }) {
  const [vid, setVid] = useState("VL");
  const [k, setK] = useState(K);
  const v = data.find((d) => d.vendor_id === vid) ?? data[0];
  if (!v) return null;
  const adj = shrink(v.s, v.n, pbar, k);
  const x = (p: number) => `${((p - 0.4) / 0.5) * 100}%`;
  const weight = v.n / (v.n + k);
  return (
    <div className="mt-4 rounded-lg border border-line bg-raised/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="shrink-vendor" className="text-xs text-muted">
            Vendor
          </label>
          <select id="shrink-vendor" value={vid} onChange={(e) => setVid(e.target.value)} className="input mt-1 min-h-[34px] py-1 text-sm">
            {[...data].sort((a, b) => a.vendor_name.localeCompare(b.vendor_name)).map((d) => (
              <option key={d.vendor_id} value={d.vendor_id}>
                {d.vendor_name} ({d.n} orders)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="shrink-k" className="flex justify-between text-xs text-muted">
            Prior strength <span className="tabular-nums text-ink">{k} orders</span>
          </label>
          <input id="shrink-k" type="range" min={0} max={100} value={k} onChange={(e) => setK(Number(e.target.value))} className="mt-3 w-full accent-[rgb(var(--primary))]" />
        </div>
      </div>
      <div className="relative mt-5 h-8" aria-hidden="true">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
        <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-ink-2" style={{ left: x(pbar) }} />
        <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-2 bg-panel" style={{ left: x(v.otif) }} />
        <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-ink transition-[left] duration-200" style={{ left: x(adj) }} />
      </div>
      <p className="text-sm text-ink-2" aria-live="polite">
        Raw <span className="font-semibold tabular-nums text-ink">{pct(v.otif)}</span>, adjusted{" "}
        <span className="font-semibold tabular-nums text-primary-ink">{pct(adj)}</span>. The vendor's own record carries {pct(weight, 0)} of the weight,
        the {pct(pbar)} average carries the rest.
      </p>
    </div>
  );
}
