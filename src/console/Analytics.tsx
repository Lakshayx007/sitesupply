import { useMemo } from "react";
import { ChartCard } from "../components/charts/ChartCard";
import { base, tok } from "../components/charts/echarts";
import { useQuery } from "../db/useQuery";
import { useAlertRule, type AlertRule } from "../lib/alertRule";
import { mean, median, pchartLimits, percentile } from "../lib/stats";

/* Every query below is the one shown in its "Show SQL" drawer (from docs/metrics.md). */

const Q = {
  // Alerts follow the rule chosen on Alert tuning (default: score 50+ and the truck late leaving).
  rates: (rule: AlertRule) => `SELECT ROUND(AVG(otif), 3) AS otif, ROUND(AVG(on_time), 3) AS on_time, ROUND(AVG(in_full), 3) AS in_full,
       COUNT(*) AS delivered, ROUND(SUM(${rule === "dispatch" ? "risk_score >= 50 AND pts_dispatch_late > 0" : "risk_score >= 50"}) / 25.0, 1) AS alerts_per_week
FROM orders WHERE cancelled = 0`,
  delays: `SELECT delay_hours FROM orders WHERE cancelled = 0 AND on_time = 0`,
  weekly: `SELECT CAST((julianday(substr(promised_ts, 1, 10)) - julianday('2026-04-06')) / 7 AS INT) + 1 AS week,
       COUNT(*) AS n, ROUND(AVG(otif), 3) AS otif, MAX(monsoon) AS monsoon
FROM orders WHERE cancelled = 0 GROUP BY week ORDER BY week`,
  funnelTop: `SELECT COUNT(*) AS enquiries, SUM(quoted) AS quoted, SUM(ordered) AS ordered
FROM enquiries WHERE enquiry_date <= '2026-07-12'`,
  funnelBottom: `SELECT COUNT(*) AS dispatched, SUM(o.otif) AS delivered_otif,
       SUM(o.paid_ts IS NOT NULL AND CAST(julianday(o.paid_ts) - julianday(o.delivered_ts) AS INT) <= 60) AS paid_60d,
       SUM(EXISTS (SELECT 1 FROM orders n WHERE n.customer_id = o.customer_id AND n.order_ts > o.delivered_ts
                   AND julianday(n.order_ts) <= julianday(o.delivered_ts) + 30)) AS reordered_30d
FROM orders o JOIN enquiries e USING (enquiry_id)
WHERE e.enquiry_date <= '2026-07-12' AND o.cancelled = 0`,
  material: `SELECT material, COUNT(*) AS n, ROUND(AVG(otif), 3) AS otif, ROUND(AVG(1 - on_time), 3) AS late_rate
FROM orders WHERE cancelled = 0 GROUP BY material ORDER BY otif`,
  season: `SELECT CASE monsoon WHEN 1 THEN 'Monsoon (Jun-Sep)' ELSE 'Dry (Apr-May)' END AS season,
       COUNT(*) AS n, ROUND(AVG(1 - on_time), 3) AS late_rate, ROUND(AVG(otif), 3) AS otif
FROM orders WHERE cancelled = 0 GROUP BY monsoon ORDER BY monsoon`,
};

const pct = (x: number | undefined, d = 1) => (x === undefined || !Number.isFinite(x) ? "–" : `${(x * 100).toFixed(d)}%`);

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-canvas px-5 py-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums text-ink">{value}</dd>
      <dd className="mt-0.5 text-xs text-muted">{note}</dd>
    </div>
  );
}

export function Analytics() {
  const rule = useAlertRule();
  const rates = useQuery<{ otif: number; on_time: number; in_full: number; delivered: number; alerts_per_week: number }>(Q.rates(rule)).rows[0];
  const delayRows = useQuery<{ delay_hours: number }>(Q.delays).rows;
  const delays = useMemo(() => delayRows.map((r) => r.delay_hours), [delayRows]);
  const weekly = useQuery<{ week: number; n: number; otif: number; monsoon: number }>(Q.weekly).rows;
  const top = useQuery<{ enquiries: number; quoted: number; ordered: number }>(Q.funnelTop).rows[0];
  const bottom = useQuery<{ dispatched: number; delivered_otif: number; paid_60d: number; reordered_30d: number }>(Q.funnelBottom).rows[0];
  const material = useQuery<{ material: string; n: number; otif: number; late_rate: number }>(Q.material).rows;
  const season = useQuery<{ season: string; n: number; late_rate: number; otif: number }>(Q.season).rows;

  const d = useMemo(() => ({ median: median(delays), mean: mean(delays), p90: percentile(delays, 90) }), [delays]);
  const B = useMemo(() => (typeof document === "undefined" ? null : base()), []);

  /* ---------- weekly OTIF control chart ---------- */
  const pbar = rates?.otif ?? 0.7;
  const weeklyOpt = useMemo(() => {
    if (!B || !weekly.length) return null;
    const limits = weekly.map((w) => pchartLimits(pbar, w.n));
    const firstMonsoon = weekly.find((w) => w.monsoon === 1)?.week;
    const weeks = weekly.map((w) => `W${w.week}`);
    return {
      ...B,
      legend: { show: false },
      tooltip: {
        ...B.tooltip,
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0].dataIndex;
          const w = weekly[i];
          return `Week ${w.week}${w.monsoon ? " (monsoon)" : ""}<br/>OTIF <b>${pct(w.otif)}</b> on ${w.n} orders<br/>Normal range ${pct(limits[i][0])} to ${pct(limits[i][1])}`;
        },
      },
      xAxis: { type: "category", data: weeks, boundaryGap: false, ...B.axisCommon, splitLine: { show: false } },
      yAxis: { type: "value", min: 0.3, max: 1, ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => `${Math.round(v * 100)}%` } },
      series: [
        { name: "lcl", type: "line", data: limits.map((l) => l[0]), stack: "band", symbol: "none", lineStyle: { opacity: 0 }, tooltip: { show: false } },
        {
          name: "Normal range",
          type: "line",
          data: limits.map((l) => l[1] - l[0]),
          stack: "band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { color: tok("primary-ink", 0.1) },
          markArea: firstMonsoon
            ? {
                silent: true,
                itemStyle: { color: "rgba(255,255,255,0.035)" },
                label: { show: true, position: "insideTopLeft", color: B.muted, fontSize: 11, formatter: "Monsoon" },
                data: [[{ xAxis: `W${firstMonsoon}` }, { xAxis: weeks[weeks.length - 1] }]],
              }
            : undefined,
        },
        {
          name: "OTIF",
          type: "line",
          data: weekly.map((w) => w.otif),
          symbol: "circle",
          symbolSize: 5,
          lineStyle: { width: 2, color: B.series1 },
          itemStyle: { color: B.series1 },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: B.series2, type: "dashed", width: 1 },
            label: { color: B.muted, fontSize: 11, formatter: `Average ${pct(pbar)}`, position: "insideEndTop" },
            data: [{ yAxis: pbar }],
          },
        },
      ],
    };
  }, [B, weekly, pbar]);

  /* ---------- funnel ---------- */
  const steps = useMemo(() => top && bottom
    ? [
        { k: "Enquiries", n: top.enquiries },
        { k: "Quoted", n: top.quoted },
        { k: "Ordered", n: top.ordered },
        { k: "Dispatched", n: bottom.dispatched },
        { k: "Delivered on time and in full", n: bottom.delivered_otif },
        { k: "Paid within 60 days", n: bottom.paid_60d },
        { k: "Re-ordered within 30 days", n: bottom.reordered_30d },
      ]
    : [], [top, bottom]);
  const funnelOpt = useMemo(() => {
    if (!B || !steps.length) return null;
    const rev = [...steps].reverse();
    return {
      ...B,
      grid: { ...B.grid, left: 8, right: 64 },
      tooltip: { ...B.tooltip, axisPointer: { type: "shadow" } },
      xAxis: { type: "value", ...B.axisCommon, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: "category", data: rev.map((s) => s.k), ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, color: tok("ink-2") } },
      series: [
        {
          type: "bar",
          data: rev.map((s, i) => {
            const prev = rev[i + 1];
            return { value: s.n, conv: prev ? s.n / prev.n : null };
          }),
          barWidth: 18,
          itemStyle: { color: B.series1, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: "right",
            color: tok("ink-2"),
            fontSize: 11,
            formatter: (p: { value: number; data: { conv: number | null } }) =>
              p.data.conv === null ? `${p.value.toLocaleString("en-US")}` : `${p.value.toLocaleString("en-US")}  ${Math.round(p.data.conv * 100)}%`,
          },
        },
      ],
    };
  }, [B, steps]);

  /* ---------- material ---------- */
  const materialOpt = useMemo(() => {
    if (!B || !material.length) return null;
    return {
      ...B,
      tooltip: { ...B.tooltip, axisPointer: { type: "shadow" }, valueFormatter: (v: number) => pct(v) },
      grid: { ...B.grid, right: 40 },
      xAxis: { type: "value", min: 0.5, max: 0.8, ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => `${Math.round(v * 100)}%` } },
      yAxis: { type: "category", data: material.map((m) => m.material), ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, color: tok("ink-2") } },
      series: [
        {
          name: "OTIF",
          type: "bar",
          data: material.map((m) => m.otif),
          barWidth: 16,
          itemStyle: { color: B.series1, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: "right", color: tok("ink-2"), fontSize: 11, formatter: (p: { value: number }) => pct(p.value) },
        },
      ],
    };
  }, [B, material]);

  /* ---------- monsoon vs dry ---------- */
  const seasonOpt = useMemo(() => {
    if (!B || !season.length) return null;
    return {
      ...B,
      legend: { show: true, top: 0, right: 0, textStyle: { color: B.muted, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      grid: { ...B.grid, top: 36 },
      tooltip: { ...B.tooltip, axisPointer: { type: "shadow" }, valueFormatter: (v: number) => pct(v) },
      xAxis: { type: "category", data: season.map((s) => s.season), ...B.axisCommon, splitLine: { show: false } },
      yAxis: { type: "value", max: 1, ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => `${Math.round(v * 100)}%` } },
      series: [
        { name: "Late rate", type: "bar", data: season.map((s) => s.late_rate), barWidth: 28, itemStyle: { color: B.series1, borderRadius: [4, 4, 0, 0] }, label: { show: true, position: "top", color: tok("ink-2"), fontSize: 11, formatter: (p: { value: number }) => pct(p.value) } },
        { name: "OTIF", type: "bar", data: season.map((s) => s.otif), barWidth: 28, itemStyle: { color: B.series2, borderRadius: [4, 4, 0, 0] }, label: { show: true, position: "top", color: tok("ink-2"), fontSize: 11, formatter: (p: { value: number }) => pct(p.value) } },
      ],
    };
  }, [B, season]);

  /* ---------- delay histogram ---------- */
  const bins = useMemo(() => {
    if (!delays.length) return [];
    const width = 3;
    const max = Math.ceil(Math.max(...delays) / width) * width;
    const out: { from: number; to: number; n: number }[] = [];
    for (let a = 0; a < max; a += width) out.push({ from: a, to: a + width, n: delays.filter((x) => x > a && x <= a + width).length });
    return out;
  }, [delays]);
  const histOpt = useMemo(() => {
    if (!B || !bins.length) return null;
    const line = (v: number, name: string, color: string) => ({
      xAxis: v,
      lineStyle: { color, type: "dashed" as const, width: 1.5 },
      label: { show: false },
      name: `${name} ${v.toFixed(1)} h`,
    });
    return {
      ...B,
      tooltip: {
        ...B.tooltip,
        trigger: "item" as const,
        formatter: (p: { data: [number, number, number] }) => `${p.data[2] - 3} to ${p.data[2]} h late<br/><b>${p.data[1]}</b> orders`,
      },
      xAxis: { type: "value", min: 0, max: bins[bins.length - 1].to, ...B.axisCommon, splitLine: { show: false }, name: "hours late", nameLocation: "middle", nameGap: 26, axisLabel: { ...B.axisCommon.axisLabel } },
      yAxis: { type: "value", ...B.axisCommon },
      grid: { ...B.grid, bottom: 24 },
      series: [
        {
          type: "bar",
          data: bins.map((b) => [b.from + 1.5, b.n, b.to]),
          barWidth: "92%",
          barCategoryGap: 0,
          itemStyle: { color: B.series1, borderRadius: [3, 3, 0, 0] },
          markLine: {
            silent: true,
            symbol: "none",
            data: [line(d.median, "Median", tok("ink")), line(d.mean, "Average", B.series2), line(d.p90, "P90", tok("primary-ink"))],
          },
        },
      ],
    };
  }, [B, bins, d]);

  const firstMonsoonWeek = weekly.find((w) => w.monsoon === 1)?.week;
  const lowest = weekly.length ? weekly.reduce((a, b) => (b.otif < a.otif ? b : a)) : null;
  const outside = weekly.filter((w) => {
    const [lo, hi] = pchartLimits(pbar, w.n);
    return w.otif < lo || w.otif > hi;
  }).length;

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1280px] space-y-4 px-4 py-6 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">Analytics</h1>
            <p className="mt-1 text-sm text-muted">Delivery performance from 6 Apr to 27 Sep 2026. Every chart shows the query behind it.</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
          <Kpi label="OTIF" value={pct(rates?.otif)} note={`${rates?.delivered?.toLocaleString("en-US") ?? "–"} deliveries`} />
          <Kpi label="On time" value={pct(rates?.on_time)} note="At or before the promised time" />
          <Kpi label="In full" value={pct(rates?.in_full)} note="Full quantity delivered" />
          <Kpi label="Median delay" value={delays.length ? `${d.median.toFixed(1)} h` : "–"} note={`Typical late order (${delays.length})`} />
          <Kpi label="90th-percentile delay" value={delays.length ? `${d.p90.toFixed(1)} h` : "–"} note="1 in 10 late orders is worse" />
          <Kpi label="Alerts per week" value={rates ? String(rates.alerts_per_week) : "–"} note={rule === "dispatch" ? "Score 50+ and truck late leaving" : "Score 50+ (score-alone rule)"} />
        </dl>

        <ChartCard
          title="Weekly OTIF with its normal range"
          subtitle={
            lowest
              ? `The band is the range one week can swing by chance (3 sigma). ${outside === 0 ? "No week fell outside it" : `${outside} weeks fell outside it`}, not even week ${lowest.week} at ${pct(lowest.otif, 0)}. Monsoon from week ${firstMonsoonWeek}.`
              : undefined
          }
          option={weeklyOpt}
          height={300}
          queries={[{ sql: Q.weekly }]}
          table={{
            head: ["Week", "Orders", "OTIF", "Normal range", "Season"],
            rows: weekly.map((w) => {
              const [lo, hi] = pchartLimits(pbar, w.n);
              return [`Week ${w.week}`, w.n, pct(w.otif), `${pct(lo)} to ${pct(hi)}`, w.monsoon ? "Monsoon" : "Dry"];
            }),
          }}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard
            title="Order funnel"
            subtitle="Enquiries from 6 Apr to 12 Jul 2026, so every later step had time to happen. Percent is conversion from the step before."
            option={funnelOpt}
            height={300}
            queries={[
              { label: "Enquiries, quotes and orders", sql: Q.funnelTop },
              { label: "What happened to those orders", sql: Q.funnelBottom },
            ]}
            table={{
              head: ["Step", "Count", "From step before"],
              rows: steps.map((s, i) => [s.k, s.n.toLocaleString("en-US"), i ? pct(s.n / steps[i - 1].n, 0) : "–"]),
            }}
          />
          <ChartCard
            title="How late are late orders?"
            subtitle="Hours late, for orders that missed the promised time. The tail is what costs a working day."
            option={histOpt}
            height={300}
            queries={[{ sql: Q.delays }]}
            table={{ head: ["Hours late", "Orders"], rows: bins.map((b) => [`${b.from} to ${b.to}`, b.n]) }}
            footer={
              delays.length ? (
                <span className="flex flex-wrap gap-x-5 gap-y-1">
                  {[
                    { k: "Median", v: d.median, c: "border-ink" },
                    { k: "Average", v: d.mean, c: "border-ink-2" },
                    { k: "90th percentile", v: d.p90, c: "border-primary-ink" },
                  ].map((l) => (
                    <span key={l.k} className="inline-flex items-center gap-2">
                      <span aria-hidden="true" className={`h-3 w-0 border-l-2 border-dashed ${l.c}`} />
                      {l.k} <span className="num text-ink">{l.v.toFixed(1)} h</span>
                    </span>
                  ))}
                </span>
              ) : null
            }
          />
          <ChartCard
            title="OTIF by material"
            subtitle="Ready-mix concrete is lowest, but the gap is small at this volume."
            option={materialOpt}
            height={260}
            queries={[{ sql: Q.material }]}
            table={{ head: ["Material", "Orders", "OTIF", "Late rate"], rows: material.map((m) => [m.material, m.n, pct(m.otif), pct(m.late_rate)]) }}
          />
          <ChartCard
            title="Monsoon vs dry season"
            subtitle="The late rate nearly doubles from June to September."
            option={seasonOpt}
            height={260}
            queries={[{ sql: Q.season }]}
            table={{ head: ["Season", "Orders", "Late rate", "OTIF"], rows: season.map((s) => [s.season, s.n, pct(s.late_rate), pct(s.otif)]) }}
          />
        </div>
      </div>
    </div>
  );
}
