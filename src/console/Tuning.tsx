import { CircleCheck, Clock, Eye, FlaskConical, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard } from "../components/charts/ChartCard";
import { base, tok } from "../components/charts/echarts";
import { useQuery } from "../db/useQuery";
import { setAlertRule, useAlertRule, type AlertRule } from "../lib/alertRule";
import { confusion, median, sampleSizeTwoProportions } from "../lib/stats";
import { summary } from "../lib/summary";

const CURRENT = 50;

const Q = {
  scores: `SELECT risk_score, on_time, dispatch_late, pts_dispatch_late,
       pts_vendor_recent_otif_below_80 + pts_distance_over_50km + pts_ordered_under_24h + pts_monsoon AS early_score,
       (julianday(promised_ts) - julianday(order_ts)) * 24 AS hours_order_to_promise,
       alert_lead_hours
FROM orders WHERE cancelled = 0`,
  atThreshold: (t: number, rule: AlertRule) => {
    const a = rule === "dispatch" ? `(risk_score >= ${t} AND pts_dispatch_late > 0)` : `(risk_score >= ${t})`;
    return `SELECT SUM(${a}) AS alerts,
       ROUND(1.0 * SUM(${a} AND on_time = 0) / SUM(${a}), 3) AS precision,
       ROUND(1.0 * SUM(${a} AND on_time = 0) / SUM(on_time = 0), 3) AS recall,
       ROUND(SUM(${a}) / 25.0, 1) AS alerts_per_week
FROM orders WHERE cancelled = 0`;
  },
};

interface Row {
  risk_score: number;
  on_time: number;
  dispatch_late: number;
  pts_dispatch_late: number;
  early_score: number;
  hours_order_to_promise: number;
  alert_lead_hours: number | null;
}

const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const WEEKS = 25;

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <section aria-labelledby={id} className={`panel p-5 ${className}`}>
      <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Tuning() {
  const rows = useQuery<Row>(Q.scores).rows;
  const [t, setT] = useState(CURRENT);
  const rule = useAlertRule();
  const late = useMemo(() => rows.map((r) => 1 - r.on_time), [rows]);
  // Under the dispatch rule an order can only alert if its truck was late leaving, so its effective score is 0 otherwise.
  const scoresFor = (r: AlertRule) => rows.map((x) => (r === "score" || x.pts_dispatch_late > 0 ? x.risk_score : 0));
  const scores = useMemo(() => scoresFor(rule), [rows, rule]); // eslint-disable-line react-hooks/exhaustive-deps
  const compare = useMemo(
    () =>
      rows.length
        ? (["score", "dispatch"] as AlertRule[]).map((r) => ({ r, k: confusion(scoresFor(r), late, CURRENT) }))
        : [],
    [rows, late], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const c = useMemo(() => (rows.length ? confusion(scores, late, t) : null), [rows, scores, late, t]);
  const cNow = useMemo(() => (rows.length ? confusion(scores, late, CURRENT) : null), [rows, scores, late]);

  const sweep = useMemo(() => {
    if (!rows.length) return [];
    const out = [];
    for (let th = 20; th <= 90; th += 5) {
      const k = confusion(scores, late, th);
      out.push({ th, precision: k.precision, recall: k.recall, perWeek: (k.tp + k.fp) / WEEKS });
    }
    return out;
  }, [rows, scores, late]);

  const B = useMemo(() => base(), []);
  const sweepOpt = useMemo(() => {
    if (!sweep.length) return null;
    return {
      ...B,
      legend: { show: true, top: 0, right: 0, textStyle: { color: B.muted, fontSize: 11 }, itemWidth: 14, itemHeight: 2 },
      grid: { ...B.grid, top: 32, bottom: 24 },
      tooltip: { ...B.tooltip, valueFormatter: (v: number) => pct(v, 1) },
      xAxis: { type: "category", data: sweep.map((s) => String(s.th)), boundaryGap: false, name: "alert threshold", nameLocation: "middle", nameGap: 26, ...B.axisCommon, splitLine: { show: false } },
      yAxis: { type: "value", min: 0, max: 1, ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => `${Math.round(v * 100)}%` } },
      series: [
        {
          name: "Caught (recall)",
          type: "line",
          data: sweep.map((s) => s.recall),
          symbolSize: 5,
          lineStyle: { width: 2, color: B.series1 },
          itemStyle: { color: B.series1 },
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              { xAxis: String(CURRENT), lineStyle: { color: B.series2, type: "dashed", width: 1 }, label: { formatter: "Default", color: B.muted, fontSize: 11 } },
              ...(t !== CURRENT && t % 5 === 0 ? [{ xAxis: String(t), lineStyle: { color: tok("primary-ink"), width: 1.5 }, label: { formatter: "Trying", color: tok("primary-ink"), fontSize: 11 } }] : []),
            ],
          },
        },
        { name: "Right (precision)", type: "line", data: sweep.map((s) => s.precision), symbolSize: 5, lineStyle: { width: 2, color: B.series2 }, itemStyle: { color: B.series2 } },
      ],
    };
  }, [B, sweep, t]);

  /* Two warnings */
  const stages = useMemo(() => {
    if (!rows.length) return null;
    const early = confusion(rows.map((r) => r.early_score), late, 25);
    const earlyLead = median(rows.filter((r) => r.early_score >= 25).map((r) => r.hours_order_to_promise));
    const disp = confusion(scores, late, 50);
    const dispLead = median(rows.filter((_, i) => scores[i] >= 50).map((r) => r.alert_lead_hours ?? NaN));
    const lateRows = rows.filter((r) => r.on_time === 0);
    const onRoad = lateRows.filter((r) => r.dispatch_late === 0).length / lateRows.length;
    const baseLate = lateRows.length / rows.length;
    return { early, earlyLead, disp, dispLead, onRoad, baseLate };
  }, [rows, scores, late]);

  /* Experiment planner */
  // Rounded to 3 decimals, as scripts/analysis.py does, so the result matches stats_summary.json (1,089 per group).
  const baseline = rows.length ? Math.round((rows.reduce((a, r) => a + r.on_time, 0) / rows.length) * 1000) / 1000 : 0.751;
  const [mde, setMde] = useState(5);
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.8);
  const [volume, setVolume] = useState(Math.round((summary.headline.delivered / WEEKS) * 10) / 10);
  const perArm = sampleSizeTwoProportions(baseline, Math.min(0.999, baseline + mde / 100), alpha, power);
  const weeks = (2 * perArm) / Math.max(1, volume);

  const odds = summary.logit.odds_ratios;
  const forestOpt = useMemo(() => {
    const rowsF = [...odds].sort((a, b) => a.or - b.or);
    return {
      ...B,
      grid: { ...B.grid, left: 8, right: 24, bottom: 24 },
      tooltip: {
        ...B.tooltip,
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        formatter: (ps: { dataIndex: number }[]) => {
          const r = rowsF[ps[0].dataIndex];
          return `<b>${r.factor}</b><br/>${r.or.toFixed(2)}× the odds<br/>95% range ${r.lo.toFixed(2)} to ${r.hi.toFixed(2)}<br/>p = ${r.p < 0.001 ? "< 0.001" : r.p.toFixed(3)}`;
        },
      },
      xAxis: { type: "log", min: 0.8, max: 3, name: "odds ratio (1 = no effect)", nameLocation: "middle", nameGap: 26, ...B.axisCommon, axisLabel: { ...B.axisCommon.axisLabel, formatter: (v: number) => `${v}×` } },
      yAxis: { type: "category", data: rowsF.map((r) => r.factor), ...B.axisCommon, splitLine: { show: false }, axisLabel: { ...B.axisCommon.axisLabel, color: tok("ink-2") } },
      series: [
        {
          type: "custom",
          data: rowsF.map((r, i) => [r.lo, r.hi, i]),
          renderItem: (_: unknown, api: { value: (i: number) => number; coord: (p: [number, number]) => [number, number] }) => {
            const a = api.coord([api.value(0), api.value(2)]);
            const b = api.coord([api.value(1), api.value(2)]);
            return { type: "line", shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: tok("line-strong"), lineWidth: 6, lineCap: "round" } };
          },
        },
        {
          type: "scatter",
          data: rowsF.map((r) => ({ value: r.or, itemStyle: { color: r.lo > 1 ? B.series1 : tok("canvas"), borderColor: B.series1, borderWidth: 1.5 } })),
          symbolSize: 11,
          markLine: { silent: true, symbol: "none", lineStyle: { color: B.series2, type: "dashed", width: 1 }, label: { show: false }, data: [{ xAxis: 1 }] },
        },
      ],
    };
  }, [B, odds]);

  const reading = (r: (typeof odds)[number]) =>
    r.lo > 1
      ? `${r.factor}: about ${r.or.toFixed(1)} times the odds of a late delivery, with the other factors held fixed.`
      : `${r.factor}: about ${r.or.toFixed(1)} times the odds, but the range includes 1, so at this volume it can't be told apart from no effect.`;

  const sentence = c
    ? `At threshold ${t} you would send ${((c.tp + c.fp) / WEEKS).toFixed(1)} alerts a week; ${pct(c.precision)} would be right; you'd catch ${pct(c.recall)} of late orders.`
    : "";

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1280px] space-y-4 px-4 py-6 lg:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Alert tuning</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Choose how sensitive alerts are. A false alarm costs one phone call; a missed delay can cost a crew-day and a wasted load of
            concrete. Try a threshold to see the trade-off on 25 weeks of orders.
          </p>
        </div>

        {/* Threshold */}
        <section aria-labelledby="thr" className="panel overflow-hidden">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="border-b border-line p-5 lg:border-b-0 lg:border-r">
              <h2 id="thr" className="text-[15px] font-semibold">Alert rule</h2>
              <fieldset className="mt-3">
                <legend className="sr-only">When to send an alert</legend>
                <div className="grid gap-2">
                  {(
                    [
                      { v: "dispatch", label: "Score of 50+ and the truck is late leaving", note: "Recommended. Other high scores show as Watch." },
                      { v: "score", label: "Score of 50+ alone", note: "The original rule. Catches more, with more false alarms." },
                    ] as { v: AlertRule; label: string; note: string }[]
                  ).map((o) => (
                    <label
                      key={o.v}
                      className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${
                        rule === o.v ? "border-primary-ink/60 bg-primary/10" : "border-line hover:border-line-strong"
                      }`}
                    >
                      <input type="radio" name="rule" value={o.v} checked={rule === o.v} onChange={() => setAlertRule(o.v)} className="mt-1 accent-[rgb(var(--primary))]" />
                      <span>
                        <span className="block text-sm font-medium text-ink">{o.label}</span>
                        <span className="block text-xs text-muted">{o.note}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {compare.length === 2 && (
                <table className="mt-4 w-full text-left text-sm">
                  <caption className="sr-only">The two rules at a score of {CURRENT}</caption>
                  <thead className="text-xs text-muted">
                    <tr>
                      <th scope="col" className="pb-1.5 font-medium">At {CURRENT}</th>
                      <th scope="col" className="pb-1.5 text-right font-medium">A week</th>
                      <th scope="col" className="pb-1.5 text-right font-medium">Right</th>
                      <th scope="col" className="pb-1.5 text-right font-medium">Caught</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compare.map(({ r, k }) => (
                      <tr key={r} className={`border-t border-line ${rule === r ? "text-ink" : "text-muted"}`}>
                        <th scope="row" className="py-1.5 text-left font-normal">{r === "dispatch" ? "Score and late truck" : "Score alone"}</th>
                        <td className="py-1.5 text-right tabular-nums">{((k.tp + k.fp) / WEEKS).toFixed(1)}</td>
                        <td className="py-1.5 text-right tabular-nums">{pct(k.precision)}</td>
                        <td className="py-1.5 text-right tabular-nums">{pct(k.recall)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="mt-2 text-xs text-muted">This setting also changes the live board and alerts.</p>
              <h3 className="mt-7 border-t border-line pt-5 text-[15px] font-semibold">Alert threshold</h3>
              <div className="mt-5 flex items-end justify-between">
                <label htmlFor="threshold" className="text-sm text-ink-2">
                  Send an alert at a score of
                </label>
                <output htmlFor="threshold" className="text-4xl font-semibold tabular-nums tracking-[-0.03em]">
                  {t}
                </output>
              </div>
              <input
                id="threshold"
                type="range"
                min={20}
                max={90}
                step={5}
                value={t}
                onChange={(e) => setT(Number(e.target.value))}
                className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full accent-[rgb(var(--primary))]"
                style={{ background: `linear-gradient(to right, rgb(var(--primary)) ${((t - 20) / 70) * 100}%, rgb(var(--raised)) ${((t - 20) / 70) * 100}%)` }}
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted">
                <span>20, more alerts</span>
                <span>90, fewer alerts</span>
              </div>
              <p className="mt-5 rounded-lg border border-line bg-raised/50 p-3.5 text-[15px] leading-relaxed text-ink" aria-live="polite">
                {sentence}
              </p>
              {c && cNow && t !== CURRENT && (
                <p className="mt-2 text-xs text-muted">
                  Compared with the default of {CURRENT}: {t > CURRENT ? "fewer" : "more"} alerts, {pct(Math.abs(c.recall - cNow.recall))}{" "}
                  {c.recall < cNow.recall ? "fewer" : "more"} late orders caught.
                </p>
              )}
              {c && (
                <ul className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm" aria-label="Alerts against what happened">
                  {[
                    { k: "Alert, and it was late", v: c.tp, note: "Caught", icon: CircleCheck, tone: "text-good" },
                    { k: "Alert, but on time", v: c.fp, note: "False alarm", icon: Eye, tone: "text-watch" },
                    { k: "No alert, but late", v: c.fn, note: "Missed", icon: Clock, tone: "text-late" },
                    { k: "No alert, on time", v: c.tn, note: "Quiet", icon: CircleCheck, tone: "text-muted" },
                  ].map(({ k, v, note, icon: Icon, tone }) => (
                    <li key={k} className="bg-panel p-3.5">
                      <p className={`flex items-center gap-1.5 text-xs font-medium ${tone}`}>
                        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                        {note}
                      </p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
                      <p className="text-xs text-muted">{k}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="min-w-0 p-2">
              <ChartCard
                className="border-0 bg-transparent"
                title="Catching more means more false alarms"
                subtitle="Share of late orders caught, and share of alerts that were right, at each threshold."
                option={sweepOpt}
                height={360}
                queries={[{ label: `At threshold ${t}`, sql: Q.atThreshold(t, rule) }]}
                table={{ head: ["Threshold", "Alerts a week", "Right", "Caught"], rows: sweep.map((s) => [s.th, s.perWeek.toFixed(1), pct(s.precision, 1), pct(s.recall, 1)]) }}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          {/* Two warnings */}
          <Panel title="Two warnings, not one" sub="An early watch when the order is placed, and the alert at the dispatch check.">
            {stages && (
              <>
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
                  {[
                    { name: "Early watch", when: "When the order is placed, score 25+", icon: Eye, tone: "text-watch", lead: stages.earlyLead, k: stages.early },
                    { name: "Delay alert", when: rule === "dispatch" ? "An hour after planned dispatch, score 50+ and truck late" : "An hour after planned dispatch, score 50+", icon: TriangleAlert, tone: "text-risk", lead: stages.dispLead, k: stages.disp },
                  ].map((s) => (
                    <div key={s.name} className="bg-panel p-4">
                      <p className={`flex items-center gap-1.5 text-sm font-semibold ${s.tone}`}>
                        <s.icon aria-hidden="true" className="h-4 w-4" />
                        {s.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">{s.when}</p>
                      <dl className="mt-4 space-y-2.5 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Warning before due</dt>
                          <dd className="font-semibold tabular-nums">{s.lead > 24 ? Math.round(s.lead) : s.lead.toFixed(1)} h</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Alerts that were right</dt>
                          <dd className="font-semibold tabular-nums">{pct(s.k.precision)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Late orders caught</dt>
                          <dd className="font-semibold tabular-nums">{pct(s.k.recall)}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink-2">
                  The early watch gives days of warning but is right only {pct(stages.early.precision)} of the time, barely better than the{" "}
                  {pct(stages.baseLate)} base rate. The dispatch alert is far more accurate but gives hours. And {pct(stages.onRoad)} of late
                  orders leave on time and get stuck on the road, which no dispatch check can see. That is why live GPS tracking is next on
                  the roadmap.
                </p>
              </>
            )}
          </Panel>

          {/* Experiment planner */}
          <Panel title="Plan a rollout test" sub="How many orders an A/B test needs to prove alerts raise on-time delivery.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="mde" className="flex justify-between text-sm text-ink-2">
                  Smallest gain worth finding
                  <span className="font-semibold tabular-nums text-ink">+{mde} pts</span>
                </label>
                <input id="mde" type="range" min={1} max={15} value={mde} onChange={(e) => setMde(Number(e.target.value))} className="mt-2 w-full accent-[rgb(var(--primary))]" />
                <p className="mt-1 text-xs text-muted">
                  From {pct(baseline, 1)} on time today to {pct(Math.min(0.999, baseline + mde / 100), 1)}
                </p>
              </div>
              <div>
                <label htmlFor="vol" className="text-sm text-ink-2">
                  Orders a week
                </label>
                <input id="vol" type="number" min={1} value={volume} onChange={(e) => setVolume(Number(e.target.value) || 1)} className="input mt-2" />
              </div>
              <div>
                <label htmlFor="alpha" className="text-sm text-ink-2">
                  False-positive risk (alpha)
                </label>
                <select id="alpha" value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="input mt-2">
                  <option value={0.01}>1%</option>
                  <option value={0.05}>5%</option>
                  <option value={0.1}>10%</option>
                </select>
              </div>
              <div>
                <label htmlFor="power" className="text-sm text-ink-2">
                  Chance to detect it (power)
                </label>
                <select id="power" value={power} onChange={(e) => setPower(Number(e.target.value))} className="input mt-2">
                  <option value={0.8}>80%</option>
                  <option value={0.9}>90%</option>
                </select>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
              <div className="bg-panel p-4">
                <p className="text-xs text-muted">Orders in each group</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-[-0.02em]">{perArm.toLocaleString("en-US")}</p>
              </div>
              <div className="bg-panel p-4">
                <p className="text-xs text-muted">Weeks at {volume} orders a week</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums tracking-[-0.02em]">{weeks.toFixed(1)}</p>
              </div>
            </div>
            <p className="mt-4 flex gap-2 text-sm leading-relaxed text-ink-2">
              <FlaskConical aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" />
              {weeks > 12
                ? "Too slow for a classic A/B test at this volume. Roll out site by site instead and compare before and after (a staggered rollout), or test only for big effects."
                : "Short enough for a classic A/B test: split orders at random between alerts on and off."}
            </p>
          </Panel>
        </div>

        <ChartCard
          title="What makes a delivery late"
          subtitle={`Logistic regression on ${summary.logit.n.toLocaleString("en-US")} deliveries. Filled dot: the effect is clear. Hollow: can't tell it from no effect. Used to check the score's rules point the right way.`}
          option={forestOpt}
          height={260}
          source="data/stats_summary.json (scripts/analysis.py)"
          table={{
            head: ["Factor", "Odds ratio", "95% range", "p-value"],
            rows: odds.map((r) => [r.factor, `${r.or.toFixed(2)}×`, `${r.lo.toFixed(2)} to ${r.hi.toFixed(2)}`, r.p < 0.001 ? "< 0.001" : r.p.toFixed(3)]),
          }}
          footer={
            <ul className="mb-2 space-y-1 text-[13px] text-ink-2">
              {[...odds].sort((a, b) => b.or - a.or).map((r) => (
                <li key={r.factor}>{reading(r)}</li>
              ))}
            </ul>
          }
        />
      </div>
    </div>
  );
}
