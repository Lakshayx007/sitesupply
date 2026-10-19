import { FlaskConical } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "../db/useQuery";
import { confusion, mean, median, percentile, sampleSizeTwoProportions } from "../lib/stats";
import { summary } from "../lib/summary";

const ChartCard = lazy(() => import("../components/charts/ChartCard").then((m) => ({ default: m.ChartCard })));
const Documents = lazy(() => import("./CaseStudyDocs").then((m) => ({ default: m.Documents })));

/* Chart options are built lazily too, so echarts stays out of the landing-page bundle. */
type Opts = typeof import("../components/charts/options");
function useOpts(): Opts | null {
  const [o, setO] = useState<Opts | null>(null);
  useEffect(() => {
    import("../components/charts/options").then(setO);
  }, []);
  return o;
}

const pct = (x: number | undefined, d = 1) => (x === undefined || !Number.isFinite(x) ? "–" : `${(x * 100).toFixed(d)}%`);

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Problem and users" },
  { id: "score", label: "How the score works" },
  { id: "insights", label: "Eight insights" },
  { id: "methods", label: "Which test, and why" },
  { id: "documents", label: "Product documents" },
  { id: "data", label: "Data and method" },
];

const SQL = {
  repeat: `SELECT o.otif, COUNT(*) AS deliveries,
       ROUND(AVG(EXISTS (SELECT 1 FROM orders n WHERE n.customer_id = o.customer_id
                         AND n.order_ts > o.delivered_ts
                         AND julianday(n.order_ts) <= julianday(o.delivered_ts) + 30)), 3) AS repeat_30d
FROM orders o
WHERE o.cancelled = 0 AND o.delivered_ts <= '2026-08-29 00:00'
GROUP BY o.otif`,
  gk: `SELECT ROUND(AVG(vendor_id IN ('VG','VK')), 3) AS share_of_orders,
       (SELECT ROUND(AVG(vendor_id IN ('VG','VK')), 3) FROM orders WHERE cancelled = 0 AND on_time = 0) AS share_of_late,
       (SELECT ROUND(AVG(otif), 3) FROM orders WHERE cancelled = 0 AND vendor_id IN ('VG','VK')) AS otif_gk,
       (SELECT ROUND(AVG(otif), 3) FROM orders WHERE cancelled = 0 AND vendor_id NOT IN ('VG','VK')) AS otif_others
FROM orders WHERE cancelled = 0`,
  weekly: `SELECT CAST((julianday(substr(promised_ts,1,10)) - julianday('2026-04-06')) / 7 AS INT) + 1 AS week,
       COUNT(*) AS n, ROUND(AVG(otif), 3) AS otif
FROM orders WHERE cancelled = 0 GROUP BY week ORDER BY week`,
  scores: `SELECT risk_score, on_time,
       pts_vendor_recent_otif_below_80 + pts_distance_over_50km + pts_ordered_under_24h + pts_monsoon AS early_score,
       (julianday(promised_ts) - julianday(order_ts)) * 24 AS hours_order_to_promise, alert_lead_hours
FROM orders WHERE cancelled = 0`,
  delays: `SELECT delay_hours FROM orders WHERE cancelled = 0 AND on_time = 0`,
  funnelTop: `SELECT COUNT(*) AS enquiries, SUM(quoted) AS quoted, SUM(ordered) AS ordered
FROM enquiries WHERE enquiry_date <= '2026-07-12'`,
  funnelBottom: `SELECT COUNT(*) AS dispatched, SUM(o.otif) AS delivered_otif,
       SUM(EXISTS (SELECT 1 FROM orders n WHERE n.customer_id = o.customer_id AND n.order_ts > o.delivered_ts
                   AND julianday(n.order_ts) <= julianday(o.delivered_ts) + 30)) AS reordered_30d
FROM orders o JOIN enquiries e USING (enquiry_id)
WHERE e.enquiry_date <= '2026-07-12' AND o.cancelled = 0`,
  onTime: `SELECT ROUND(AVG(on_time), 3) AS on_time, COUNT(*) / 25.0 AS orders_per_week FROM orders WHERE cancelled = 0`,
};

function H2({ id, children, sub }: { id: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8">
      <h2 id={`${id}-title`} className="display text-3xl sm:text-4xl">
        {children}
      </h2>
      {sub && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-2">{sub}</p>}
    </div>
  );
}

function Insight({
  n,
  title,
  see,
  means,
  decision,
  chart,
}: {
  n: number;
  title: string;
  see: ReactNode;
  means: ReactNode;
  decision: ReactNode;
  chart: ReactNode;
}) {
  return (
    <article className="grid gap-6 border-t border-line pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
      <div>
        <p className="num text-xs text-muted">Insight {n} of 8</p>
        <h3 className="mt-2 text-2xl font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
        <dl className="mt-5 space-y-4 text-[15px] leading-relaxed">
          <div>
            <dt className="text-sm font-medium text-muted">What we see</dt>
            <dd className="mt-1 text-ink-2">{see}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted">What it means</dt>
            <dd className="mt-1 text-ink-2">{means}</dd>
          </div>
          <div className="rounded-lg border border-primary-ink/25 bg-primary/[0.07] p-4">
            <dt className="text-sm font-medium text-primary-ink">Decision</dt>
            <dd className="mt-1 text-ink">{decision}</dd>
          </div>
        </dl>
      </div>
      <div className="min-w-0">
        <Suspense fallback={<div className="shimmer h-[300px] rounded-xl" />}>{chart}</Suspense>
      </div>
    </article>
  );
}

const METHODS = [
  { t: "Proportions and OTIF", what: "A count divided by a total.", here: "70% of delivered orders were on time and in full; 75% on time and 93% in full.", say: "OTIF combines two promises, time and quantity, so it's stricter than either on its own." },
  { t: "Median, average and 90th percentile", what: "The middle value, the mean, and the value 90% of orders are below.", here: "Median delay 7 hours, average 10.9, 90th percentile 22.3.", say: "Delays are skewed, so I use the median for the typical case and the 90th percentile for the painful tail." },
  { t: "Control chart (p-chart)", what: "A weekly rate with a normal-range band that is wider when a week has fewer orders.", here: "No week fell outside the band, even the 52% week.", say: "A control chart stops the team from over-reacting to one bad week." },
  { t: "Confidence interval (Wilson)", what: "A range that probably contains the true value. It behaves well for small counts.", here: "Vendor L shows 67% on only 21 orders, so the true value could be 45% to 83%.", say: "Every vendor score comes with how sure we are." },
  { t: "Shrinkage (empirical Bayes)", what: "Pull small-sample scores toward the average, in proportion to how little data there is.", here: "Vendor L's 67% becomes about 68%; Vendor G's 57% on 205 orders hardly moves.", say: "Shrinkage stops a new vendor with three lucky orders from topping the leaderboard." },
  { t: "Comparing two groups (chi-square)", what: "Checks whether a gap between groups is bigger than chance would produce.", here: "Late rate 29.7% in the monsoon against 16.5% in the dry season; p < 0.001; the gap is 8 to 18 points.", say: "The monsoon effect is real, not noise, and I quote it as a range." },
  { t: "Logistic regression and odds ratios", what: "Estimates how much each factor changes the odds of being late, holding the others fixed.", here: "Monsoon about 2×, rush 1.7×, long distance 1.6×, poor vendor record 1.5×. Ready-mix's small effect was not clear.", say: "I used the regression to check the score's rules point the right way, and which matter most." },
  { t: "Precision and recall", what: "Of the alerts sent, how many were right; of the late orders, how many were warned about.", here: "56% precision and 83% recall at threshold 50.", say: "I picked the threshold from the cost of a missed delay versus a false alarm." },
  { t: "Sample size and power", what: "How many orders an experiment needs to reliably see an effect of a given size.", here: "1,089 orders per group to detect a 5-point gain from a 75% base.", say: "A classic A/B test was too slow, so I chose a staggered rollout." },
  { t: "Funnel conversion and cohorts", what: "How many reach each step, for a group that started in the same period.", here: "Enquiries from 6 Apr to 12 Jul, so every later step had time to happen.", say: "A fixed cohort stops recent enquiries that haven't had time to convert from dragging the funnel down." },
];

const PLANTED = [
  ["Vendors G and K are unreliable", "+1.0 and +0.9 on the log-odds of being late; 12% short-delivery chance (others 5%)"],
  ["…and cheaper", "Price index 0.95, so they win more orders"],
  ["Monsoon delays", "+0.8 log-odds from June to September; late orders are also 30% longer"],
  ["Long routes", "+0.6 log-odds when the distance is over 50 km"],
  ["Rush orders", "+0.7 log-odds when ordered under 24 h before need (about 18% of orders)"],
  ["Ready-mix concrete", "+0.3 log-odds (small, and not detected at this sample size)"],
  ["Late or short delivery reduces demand", "The customer's enquiry rate is ×0.6 for 30 days afterwards"],
  ["New vendor", "Vendor L joins on 3 Aug 2026"],
  ["Dispatch signal", "80% of late orders leave the plant late; 20% leave on time and are delayed on the road"],
];

export default function CaseStudy() {
  const O = useOpts();
  const repeat = useQuery<{ otif: number; deliveries: number; repeat_30d: number }>(SQL.repeat).rows;
  const gk = useQuery<{ share_of_orders: number; share_of_late: number; otif_gk: number; otif_others: number }>(SQL.gk).rows[0];
  const weekly = useQuery<{ week: number; n: number; otif: number }>(SQL.weekly).rows;
  const scores = useQuery<{ risk_score: number; on_time: number; early_score: number; hours_order_to_promise: number; alert_lead_hours: number | null }>(SQL.scores).rows;
  const delayRows = useQuery<{ delay_hours: number }>(SQL.delays).rows;
  const top = useQuery<{ enquiries: number; quoted: number; ordered: number }>(SQL.funnelTop).rows[0];
  const bottom = useQuery<{ dispatched: number; delivered_otif: number; reordered_30d: number }>(SQL.funnelBottom).rows[0];
  const base = useQuery<{ on_time: number; orders_per_week: number }>(SQL.onTime).rows[0];
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  const good = repeat.find((r) => r.otif === 1);
  const bad = repeat.find((r) => r.otif === 0);
  const late = useMemo(() => scores.map((r) => 1 - r.on_time), [scores]);
  const sweep = useMemo(() => {
    if (!scores.length) return [];
    const s = scores.map((r) => r.risk_score);
    return [40, 45, 50, 55, 60, 65].map((t) => ({ t, ...confusion(s, late, t) }));
  }, [scores, late]);
  const at = (t: number) => sweep.find((s) => s.t === t);
  const stages = useMemo(() => {
    if (!scores.length) return null;
    const early = confusion(scores.map((r) => r.early_score), late, 25);
    return {
      early,
      earlyLead: median(scores.filter((r) => r.early_score >= 25).map((r) => r.hours_order_to_promise)),
      disp: confusion(scores.map((r) => r.risk_score), late, 50),
      dispLead: median(scores.filter((r) => r.risk_score >= 50).map((r) => r.alert_lead_hours ?? NaN)),
    };
  }, [scores, late]);
  const delays = useMemo(() => delayRows.map((r) => r.delay_hours), [delayRows]);
  const d = useMemo(() => ({ med: median(delays), avg: mean(delays), p90: percentile(delays, 90) }), [delays]);
  const bins = useMemo(() => {
    const out: { label: string; n: number }[] = [];
    for (let a = 0; a < 36; a += 3) out.push({ label: `${a}–${a + 3}`, n: delays.filter((x) => x > a && x <= a + 3).length });
    out.push({ label: "36+", n: delays.filter((x) => x > 36).length });
    return out;
  }, [delays]);
  const steps = top && bottom
    ? [
        ["Enquiries", top.enquiries],
        ["Quoted", top.quoted],
        ["Ordered", top.ordered],
        ["Dispatched", bottom.dispatched],
        ["Delivered on time and in full", bottom.delivered_otif],
        ["Re-ordered within 30 days", bottom.reordered_30d],
      ] as [string, number][]
    : [];
  const p0 = base?.on_time ?? 0.751; // already rounded to 3 decimals in SQL, as in scripts/analysis.py
  const vol = base?.orders_per_week ?? 45.5;
  const mdes = [3, 4, 5, 6, 7, 8, 9, 10];
  const weeksFor = (m: number) => (2 * sampleSizeTwoProportions(p0, p0 + m / 100, 0.05, 0.8)) / vol;

  return (
    <div className="relative">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="grid-bg pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_60%_80%_at_30%_0%,#000,transparent)]" />
        <div className="relative mx-auto max-w-page px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <p className="eyebrow">Case study</p>
          <h1 className="display mt-4 max-w-4xl text-[44px] leading-[1.04] sm:text-6xl">How SiteSupply was designed, and what the data said.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
            A product-management project by Lakshay Malik: the problem, the users, the rules behind the score, eight findings and the decisions
            they led to, and the documents behind the build.
          </p>
          <div id="overview" className="mt-10 flex max-w-3xl scroll-mt-24 gap-3 rounded-xl border border-watch/30 bg-watch/[0.06] p-5">
            <FlaskConical aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-watch" />
            <div className="text-[15px] leading-relaxed text-ink-2">
              <p className="font-semibold text-ink">All order data here is sample data.</p>
              <p className="mt-1">
                It was generated by a program (seed 42) for 25 weeks, with some patterns planted on purpose, such as two unreliable vendors and
                more delays in the monsoon. The project shows how a product manager would find and use these patterns. It does not claim
                real-world results. See <a href="#data" onClick={(e) => { e.preventDefault(); document.getElementById("data")?.scrollIntoView({ behavior: "smooth" }); }} className="link">data and method</a>.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-page gap-12 px-4 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Table of contents */}
        <nav aria-label="On this page" className="hidden lg:block">
          <ol className="sticky top-24 mt-16 space-y-1 border-l border-line">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })}
                  className={`-ml-px border-l py-1.5 pl-4 text-left text-sm transition-colors ${
                    active === s.id ? "border-primary-ink text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-28 py-16">
          {/* Problem and users */}
          <section id="users" aria-labelledby="users-title" className="scroll-mt-24">
            <H2 id="users" sub="Site teams learn a delivery is late only when the truck doesn't come. The signs were usually visible earlier; nobody put them together in time.">
              Problem and users
            </H2>
            <div className="scroll-thin overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-raised/60 text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">User</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Trying to</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">What hurts today</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Site engineer (main user)", "Keep the day's work running", "Finds out about delays only when the truck doesn't come; crew sits idle"],
                    ["Procurement manager", "Buy at a fair price from vendors who deliver", "Can't see which vendors are reliable; chooses on price alone"],
                    ["Vendor dispatcher", "Load and send trucks on time", "Gets angry calls after the fact; no early nudge"],
                    ["Operations manager", "Keep OTIF high across thousands of orders", "Problems show up in monthly reports, too late to fix"],
                  ].map((r) => (
                    <tr key={r[0]} className="border-t border-line">
                      <th scope="row" className="px-4 py-3 text-left font-medium text-ink">{r[0]}</th>
                      <td className="px-4 py-3 text-ink-2">{r[1]}</td>
                      <td className="px-4 py-3 text-ink-2">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Score */}
          <section id="score" aria-labelledby="score-title" className="scroll-mt-24">
            <H2 id="score" sub="Simple, visible rules instead of a black-box model, because a site engineer has to trust an alert before acting on it.">
              How the score works
            </H2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="panel p-5">
                <p className="text-sm font-semibold">Points for each warning sign</p>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {[
                    ["+40", "Truck not out an hour after planned dispatch"],
                    ["+25", "Vendor on time and in full on under 80% of its last 10 orders"],
                    ["+15", "Route longer than 50 km"],
                    ["+10", "Ordered under 24 hours before needed"],
                    ["+10", "Monsoon season"],
                  ].map(([p, t]) => (
                    <li key={t} className="flex gap-3 py-2.5">
                      <span className="num w-9 font-semibold text-primary-ink">{p}</span>
                      <span className="text-ink-2">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel p-5">
                <p className="text-sm font-semibold">Two warnings, not one</p>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">
                  <span className="font-medium text-ink">Early watch</span> when the order is placed: only the vendor's record, distance, rush and
                  season are known. Days of warning, often wrong.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">
                  <span className="font-medium text-ink">Delay alert</span> at the dispatch check, an hour after the truck was due out. Much more
                  accurate, but hours of warning. At 50 points or more an alert goes out with the reasons.
                </p>
                <Link to="/console/tuning" className="link mt-4 inline-block text-sm">
                  Try the threshold yourself
                </Link>
              </div>
            </div>
          </section>

          {/* Insights */}
          <section id="insights" aria-labelledby="insights-title" className="scroll-mt-24">
            <H2 id="insights" sub="Each one follows the same pattern: what the data shows, what it means, and the decision it leads to. Every chart runs its query in your browser.">
              Eight insights
            </H2>
            <div className="space-y-14">
              <Insight
                n={1}
                title="Reliability drives repeat orders, so OTIF is the right north star"
                see={<>After an on-time, in-full delivery, {pct(good?.repeat_30d, 0)} of customers ordered again within 30 days. After a late or short delivery, only {pct(bad?.repeat_30d, 0)} did ({good?.deliveries} and {bad?.deliveries} deliveries; p ≈ 0.001).</>}
                means="This pattern was planted, but it is exactly the logic a real platform lives by: a builder comes back if materials arrive on time and in full."
                decision="Make the north star the monthly value of orders delivered on time and in full. Growth only counts if it is reliable growth."
                chart={
                  O && good && bad && (
                    <ChartCard
                      title="Repeat within 30 days of a delivery"
                      option={O.barsV(["After an OTIF delivery", "After a late or short one"], [good.repeat_30d, bad.repeat_30d], { percent: true, max: 0.7 })}
                      height={280}
                      queries={[{ sql: SQL.repeat }]}
                      table={{ head: ["Delivery", "Deliveries", "Re-ordered in 30 days"], rows: [["On time and in full", good.deliveries, pct(good.repeat_30d)], ["Late or short", bad.deliveries, pct(bad.repeat_30d)]] }}
                    />
                  )
                }
              />
              <Insight
                n={2}
                title="Two vendors cause half the problem, and they win because they are cheaper"
                see={<>Vendors G and K handle {pct(gk?.share_of_orders, 0)} of orders but cause {pct(gk?.share_of_late, 0)} of late deliveries. Their OTIF is about {pct(gk?.otif_gk, 0)}, against {pct(gk?.otif_others, 0)} for everyone else.</>}
                means="They stay busy because they are about 5% cheaper. Price alone hides the true cost of a late truck."
                decision="Show procurement a reliability score next to the price, and give vendors their own scorecard so they can improve."
                chart={
                  O && gk && (
                    <ChartCard
                      title="Vendors G and K"
                      option={O.barsV(["Share of all orders", "Share of late deliveries"], [gk.share_of_orders, gk.share_of_late], { percent: true, max: 0.7 })}
                      height={280}
                      queries={[{ sql: SQL.gk }]}
                      table={{ head: ["Measure", "Value"], rows: [["Share of orders", pct(gk.share_of_orders)], ["Share of late deliveries", pct(gk.share_of_late)], ["OTIF, G and K", pct(gk.otif_gk)], ["OTIF, others", pct(gk.otif_others)]] }}
                    />
                  )
                }
              />
              <Insight
                n={3}
                title="One bad week is mostly noise; the monsoon is a real shift"
                see="Weekly OTIF swings a lot. It dropped to 52% in week 15, but that is still inside the normal range for a week of about 45 orders. OTIF was 76% before the monsoon and 66% during it; the late rate rose from 16.5% to 29.7%."
                means="The seasonal gap is about 13 points (95% range 8 to 18), very unlikely to be chance. Single weeks are not."
                decision="Don't react to single bad weeks. Build a monsoon playbook: bigger buffers for promised slots, earlier dispatch, backup vendors lined up before June."
                chart={
                  O && weekly.length > 0 && (
                    <ChartCard
                      title="Weekly OTIF"
                      option={O.lines(weekly.map((w) => `W${w.week}`), [{ name: "OTIF", values: weekly.map((w) => w.otif) }], { percent: true, min: 0.4, max: 1, markX: [{ at: "W9", label: "Monsoon starts" }] })}
                      height={280}
                      queries={[{ sql: SQL.weekly }]}
                      table={{ head: ["Week", "Orders", "OTIF"], rows: weekly.map((w) => [`Week ${w.week}`, w.n, pct(w.otif)]) }}
                      footer={<Link to="/console/analytics" className="link">See it with its control limits in Analytics</Link>}
                    />
                  )
                }
              />
              <Insight
                n={4}
                title="The alert threshold is a product decision, not a technical one"
                see={<>At the chosen threshold of 50, alerts catch {pct(at(50)?.recall, 0)} of late orders and {pct(at(50)?.precision, 0)} of alerts turn out right, about 17 a week. At 55, alerts are right {pct(at(55)?.precision, 0)} of the time but catch only {pct(at(55)?.recall, 0)}.</>}
                means="A false alarm costs one phone call. A missed delay can cost a crew-day and a wasted load of concrete."
                decision="Keep the threshold at 50. Watch % of alerts acted on: if people start ignoring alerts, that is alert fatigue, and the threshold should go up."
                chart={
                  O && sweep.length > 0 && (
                    <ChartCard
                      title="Caught and right, by threshold"
                      option={O.lines(sweep.map((s) => String(s.t)), [{ name: "Caught (recall)", values: sweep.map((s) => s.recall) }, { name: "Right (precision)", values: sweep.map((s) => s.precision) }], { percent: true, min: 0.3, max: 1, xName: "threshold", markX: [{ at: "50", label: "Chosen" }] })}
                      height={280}
                      queries={[{ sql: SQL.scores }]}
                      table={{ head: ["Threshold", "Alerts", "Right", "Caught"], rows: sweep.map((s) => [s.t, s.tp + s.fp, pct(s.precision), pct(s.recall)]) }}
                      footer={<Link to="/console/tuning" className="link">Drag the threshold in Alert tuning</Link>}
                    />
                  )
                }
              />
              <Insight
                n={5}
                title="Dispatch alerts come late; early warnings come early but are often wrong"
                see={stages ? <>The dispatch alert gives a median of {stages.dispLead.toFixed(1)} hours' warning and is right {pct(stages.disp.precision, 0)} of the time. The early watch at order time gives about {Math.round(stages.earlyLead)} hours but is right only {pct(stages.early.precision, 0)} of the time, against a 25% base late rate. And 20% of late orders leave on time and get stuck on the road.</> : "–"}
                means="Accuracy and warning time pull against each other, and the dispatch check is blind to delays on the road."
                decision="This sets the roadmap. v1 ships the dispatch alert. v2 adds live GPS tracking. The early watch is used softly, as a 'keep an eye on this' label, not a loud alert."
                chart={
                  O && stages && (
                    <ChartCard
                      title="Median hours of warning"
                      option={O.barsH(["Early watch, at order", "Delay alert, at dispatch"], [Math.round(stages.earlyLead), stages.dispLead], { suffix: " h", extra: [`${pct(stages.early.precision, 0)} right`, `${pct(stages.disp.precision, 0)} right`] })}
                      height={200}
                      queries={[{ sql: SQL.scores }]}
                      table={{ head: ["Warning", "Median hours", "Right", "Caught"], rows: [["Early watch", stages.earlyLead.toFixed(1), pct(stages.early.precision), pct(stages.early.recall)], ["Delay alert", stages.dispLead.toFixed(1), pct(stages.disp.precision), pct(stages.disp.recall)]] }}
                    />
                  )
                }
              />
              <Insight
                n={6}
                title="The long tail matters more than the average"
                see={<>A typical late order is about {d.med.toFixed(0)} hours late (median). The average is {d.avg.toFixed(1)} hours, pulled up by a few very late orders, and 1 in 10 late orders is more than {d.p90.toFixed(0)} hours late.</>}
                means="Those very late orders are the ones that cost a full working day."
                decision="Report the median and the 90th percentile, not the average. Set a separate goal for the tail: no order more than 24 hours late without a backup plan."
                chart={
                  O && delays.length > 0 && (
                    <ChartCard
                      title="How late are late orders (hours)"
                      option={O.barsV(bins.map((b) => b.label), bins.map((b) => b.n))}
                      height={280}
                      queries={[{ sql: SQL.delays }]}
                      table={{ head: ["Hours late", "Orders"], rows: bins.map((b) => [b.label, b.n]) }}
                    />
                  )
                }
              />
              <Insight
                n={7}
                title="Where the funnel leaks"
                see={top && bottom ? <>Of {top.enquiries.toLocaleString("en-US")} enquiries, {pct(top.quoted / top.enquiries, 0)} got a quote but only {pct(top.ordered / top.enquiries, 0)} became orders. Then {bottom.delivered_otif} were delivered on time and in full, and {bottom.reordered_30d} led to a repeat order within 30 days.</> : "–"}
                means="The biggest drop is quote to order, a pricing and sales problem. The biggest drop on the delivery side is dispatched to delivered on time and in full, the one SiteSupply attacks."
                decision="Stay focused. SiteSupply owns the delivery part of the funnel. The quote-to-order drop belongs to another team, and a PM should say so out loud."
                chart={
                  O && steps.length > 0 && (
                    <ChartCard
                      title="Order funnel, enquiries 6 Apr to 12 Jul"
                      option={O.barsH(steps.map((s) => s[0]), steps.map((s) => s[1]), { extra: steps.map((s, i) => (i ? `${Math.round((s[1] / steps[i - 1][1]) * 100)}%` : null)) })}
                      height={280}
                      queries={[{ label: "Enquiries", sql: SQL.funnelTop }, { label: "Orders from those enquiries", sql: SQL.funnelBottom }]}
                      table={{ head: ["Step", "Count"], rows: steps.map((s) => [s[0], s[1].toLocaleString("en-US")]) }}
                    />
                  )
                }
              />
              <Insight
                n={8}
                title="You can't A/B test this at small volume"
                see={<>To check whether alerts raise on-time delivery from {pct(p0, 0)} to {pct(p0 + 0.05, 0)}, a normal A/B test needs about {sampleSizeTwoProportions(p0, p0 + 0.05).toLocaleString("en-US")} orders in each group. At {Math.round(vol)} orders a week that takes {weeksFor(5).toFixed(0)} weeks. Even an 8-point jump needs about {weeksFor(8).toFixed(0)} weeks.</>}
                means="At real platform scale a test like this takes days. At small scale, only big effects can be detected."
                decision="Use a switchback or staggered rollout: turn the feature on site by site and compare before and after. Knowing this before launch is part of the plan."
                chart={
                  O && (
                    <ChartCard
                      title="Weeks needed, by the gain you want to detect"
                      option={O.lines(mdes.map((m) => `+${m}`), [{ name: "Weeks", values: mdes.map((m) => Math.round(weeksFor(m) * 10) / 10) }], { xName: "percentage points" })}
                      height={280}
                      source="computed in your browser (Cohen's h, alpha 5%, power 80%)"
                      table={{ head: ["Gain", "Orders per group", "Weeks"], rows: mdes.map((m) => [`+${m} pts`, sampleSizeTwoProportions(p0, p0 + m / 100).toLocaleString("en-US"), weeksFor(m).toFixed(1)]) }}
                    />
                  )
                }
              />
            </div>
          </section>

          {/* Methods */}
          <section id="methods" aria-labelledby="methods-title" className="scroll-mt-24">
            <H2 id="methods" sub="Every method used, what it is, the example from the data, and a one-line way to say it.">
              Which test, and why
            </H2>
            <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-2">
              {METHODS.map((m, i) => (
                <article key={m.t} className="bg-canvas p-6">
                  <p className="num text-xs text-muted">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.01em]">{m.t}</h3>
                  <p className="mt-2 text-sm text-ink-2">{m.what}</p>
                  <p className="mt-2 text-sm text-ink-2">
                    <span className="text-muted">Here: </span>
                    {m.here}
                  </p>
                  <p className="mt-3 border-l-2 border-primary-ink/50 pl-3 text-sm italic text-ink">"{m.say}"</p>
                </article>
              ))}
            </div>
          </section>

          {/* Documents */}
          <section id="documents" aria-labelledby="documents-title" className="scroll-mt-24">
            <H2 id="documents" sub="The PRD, stories, prioritisation and plans behind the build. Rendered from the markdown files in the repo.">
              Product documents
            </H2>
            <Suspense fallback={<div className="shimmer h-96 rounded-xl" />}>
              <Documents />
            </Suspense>
          </section>

          {/* Data and method */}
          <section id="data" aria-labelledby="data-title" className="scroll-mt-24">
            <H2 id="data" sub="All order data is synthetic, generated by scripts/make_sample_data.py with seed 42, covering 25 weeks from 6 April to 27 September 2026, monsoon months included.">
              Data and method
            </H2>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                [summary.headline.orders.toLocaleString("en-US"), `orders (${summary.headline.delivered.toLocaleString("en-US")} delivered, ${summary.headline.cancelled} cancelled)`],
                [summary.headline.enquiries.toLocaleString("en-US"), "enquiries"],
                [String(summary.vendors.length), "vendors, Vendor A to Vendor L"],
                ["300", "builders and contractors"],
              ].map(([v, k]) => (
                <div key={k} className="panel p-5">
                  <p className="text-3xl font-semibold tabular-nums tracking-[-0.02em]">{v}</p>
                  <p className="mt-1 text-sm text-muted">{k}</p>
                </div>
              ))}
            </div>
            <h3 className="mt-10 text-lg font-semibold">What was planted on purpose</h3>
            <div className="scroll-thin mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-raised/60 text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Pattern</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">How it was planted</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANTED.map(([p, h]) => (
                    <tr key={p} className="border-t border-line">
                      <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink">{p}</th>
                      <td className="px-4 py-2.5 text-ink-2">{h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="panel p-5">
                <h3 className="font-semibold">Why plant patterns?</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  It lets us check whether the methods find what we know is there, like testing a metal detector on a beach where you buried the
                  coins yourself. It shows the difference between a method and a finding. The regression recovered the planted effects, and
                  missed the small ready-mix one: with about 1,100 orders you can't reliably detect small effects.
                </p>
              </div>
              <div className="panel p-5">
                <h3 className="font-semibold">Limits</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
                  <li>All data is synthetic, so the findings demonstrate methods, not real-world facts.</li>
                  <li>The planted effects were chosen by me, so finding them tests the method, not a discovery.</li>
                  <li>The cost of a delay is described in words, not rupees. Real cost data would sharpen the threshold.</li>
                  <li>There are no real user interviews yet. The research plan is a template.</li>
                </ul>
              </div>
            </div>
            <h3 className="mt-10 text-lg font-semibold">Reproduce it</h3>
            <pre className="scroll-thin mt-3 overflow-x-auto rounded-xl border border-line bg-panel p-4 font-mono text-[13px] text-ink-2">
              python scripts/make_sample_data.py && python scripts/analysis.py && python scripts/build_sqlite.py
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
