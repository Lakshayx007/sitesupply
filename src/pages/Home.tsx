import { motion, useInView, useReducedMotion } from "framer-motion";
import { Bell, Code2, Eye, LayoutList, Lock, MessageSquareText, Radar, Smartphone, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AskPanel } from "../components/ask/AskPanel";
import { Story } from "../components/home/Story";
import { PhoneFrame } from "../components/PhoneFrame";
import { RiskBadge, StatusChip } from "../components/ui";
import { ConsoleProvider, useConsole } from "../console/ConsoleContext";
import { OrderDetail } from "../console/OrderDetail";
import { useQuery } from "../db/useQuery";
import { STATUS_RANK, isDelivered, isPlaced, liveScore, liveStatus, ts } from "../lib/live";
import { HERO_ORDER_ID, dayMonth, hhmm, unitLabel } from "../lib/orders";
import { isAlert, useAlertRule } from "../lib/alertRule";
import { confusion, median } from "../lib/stats";

const HERO_FROM = ts("2026-09-26 04:20");
const HERO_TO = ts("2026-09-26 06:40");

/* ---------------- Hero console: the real board, replaying a morning ---------------- */

function HeroBoard() {
  const { now, setNow, setPlaying, setSpeed, orders, byId, loading } = useConsole();
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState(HERO_ORDER_ID);
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (loading || started.current) return;
    started.current = true;
    if (reduce) {
      setNow(HERO_TO);
      return;
    }
    setNow(HERO_FROM);
    setSpeed(28); // minutes per second: the morning plays in about five seconds
    setTimeout(() => setPlaying(true), 700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reduce]);

  useEffect(() => {
    if (now >= HERO_TO) setPlaying(false);
  }, [now, setPlaying]);

  const rows = useMemo(
    () =>
      orders
        .filter((o) => isPlaced(o, now) && (!isDelivered(o, now) || now - ts(o.delivered_ts!) < 24 * 60))
        .map((o) => ({ o, status: liveStatus(o, now), score: liveScore(o, now).score }))
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || ts(a.o.promised_ts) - ts(b.o.promised_ts))
        .slice(0, 11),
    [orders, now],
  );
  const order = byId.get(selected);
  const time = new Date(now * 60000).toISOString().slice(11, 16);
  const atRisk = rows.filter((r) => r.status === "at-risk" || r.status === "delayed").length;

  if (loading || !order) return <div className="shimmer h-[600px] w-full rounded-2xl" />;

  return (
    <div className="frame overflow-hidden">
      {/* App chrome */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        </span>
        <p className="text-xs text-muted">Live board</p>
        <p className="num ml-auto text-xs text-ink-2">
          Sat 26 Sep, <span className="text-ink">{time}</span>
        </p>
      </div>
      <div className="grid h-[600px] md:grid-cols-[minmax(0,1fr)_380px] lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hidden min-h-0 flex-col md:flex">
          <div className="flex items-center gap-4 border-b border-line px-5 py-3 text-xs">
            <span className="text-muted">
              Open orders <span className="num ml-1 text-ink">{rows.filter((r) => !r.status.startsWith("delivered")).length}</span>
            </span>
            <span className="text-muted">
              Need action <span className={`num ml-1 ${atRisk ? "text-risk" : "text-ink"}`}>{atRisk}</span>
            </span>
          </div>
          <ul className="min-h-0 flex-1 overflow-hidden">
            {rows.map(({ o, status, score }) => (
              <motion.li layout="position" key={o.order_id} transition={{ duration: 0.35 }}>
                <button
                  onClick={() => setSelected(o.order_id)}
                  className={`flex w-full items-center gap-4 border-b border-line px-5 py-2.5 text-left transition-colors ${
                    o.order_id === selected ? "bg-raised" : "hover:bg-raised/50"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{o.material}</span>
                    <span className="block truncate text-xs text-muted">
                      {o.site_name.replace(/ \(.*\)/, "")}, {o.qty_ordered} {unitLabel(o.unit)} from {o.vendor_name}
                    </span>
                  </span>
                  <span className="num hidden w-24 text-xs text-muted xl:block">
                    {dayMonth(o.promised_ts)} {hhmm(o.promised_ts)}
                  </span>
                  <span className="hidden w-[108px] lg:block">
                    <StatusChip status={status} />
                  </span>
                  <RiskBadge score={score} status={status} size={30} />
                </button>
              </motion.li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-2.5">
            <button onClick={() => navigate("/console")} className="text-xs text-primary-ink hover:underline">
              Open the full console
            </button>
          </div>
        </div>
        <div className="min-h-0 border-line bg-panel md:border-l">
          <OrderDetail order={order} compact />
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] } };
  return (
    <section aria-labelledby="hero-title" className="relative">
      <div
        aria-hidden="true"
        className="grid-bg pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-40 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_20%,#000_20%,transparent_75%)]"
      />
      <div className="relative mx-auto max-w-page px-4 pt-16 sm:px-6 sm:pt-24">
        <motion.h1 id="hero-title" {...enter(0)} className="display max-w-4xl text-[44px] leading-[1.02] sm:text-6xl lg:text-[76px]">
          Know about a late delivery before your crew does.
        </motion.h1>
        <motion.p {...enter(0.08)} className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-2 sm:text-xl">
          SiteSupply watches every order of cement, steel and ready-mix concrete, scores its delay risk, and warns the site team
          hours before the truck is late, with the reasons and what to do next.
        </motion.p>
        <motion.div {...enter(0.16)} className="mt-9 flex flex-wrap items-center gap-3">
          <Link to="/console" className="btn-primary min-h-[44px] px-5 text-[15px]">
            Open the console
          </Link>
          <Link to="/console/ask" className="btn-secondary min-h-[44px] px-5 text-[15px]">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-primary-ink" />
            Ask the data
          </Link>
        </motion.div>
      </div>
      <motion.div
        {...(reduce ? {} : { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.3, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] } })}
        className="relative mx-auto mt-16 max-w-[1280px] px-4 sm:px-6"
      >
        <ConsoleProvider initialNow={HERO_TO}>
          <HeroBoard />
        </ConsoleProvider>
      </motion.div>
    </section>
  );
}

/* ---------------- Feature rows ---------------- */

function Feature({
  title,
  body,
  points,
  visual,
  link,
  flip = false,
}: {
  title: string;
  body: string;
  points: { icon: typeof Eye; text: string }[];
  visual: ReactNode;
  link?: { to: string; label: string };
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <h3 className="display text-3xl sm:text-[40px] sm:leading-[1.1]">{title}</h3>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-2">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3 text-[15px] text-ink-2">
              <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary-ink" />
              {text}
            </li>
          ))}
        </ul>
        {link && (
          <Link to={link.to} className="link mt-7 inline-block text-[15px]">
            {link.label}
          </Link>
        )}
      </div>
      <div className={`min-w-0 ${flip ? "lg:order-1" : ""}`}>{visual}</div>
    </div>
  );
}

function RulesVisual() {
  const p = useQuery<{ d: number; v: number; k: number; r: number; m: number }>(
    `SELECT MAX(pts_dispatch_late) AS d, MAX(pts_vendor_recent_otif_below_80) AS v, MAX(pts_distance_over_50km) AS k,
            MAX(pts_ordered_under_24h) AS r, MAX(pts_monsoon) AS m FROM orders`,
  ).rows[0];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = useReducedMotion();
  if (!p) return <div className="shimmer h-[380px] rounded-2xl" />;
  const rules = [
    { pts: p.d, text: "Truck not out an hour after it was due", when: "At dispatch" },
    { pts: p.v, text: "Vendor on time and in full on under 80% of its last 10 orders", when: "At order" },
    { pts: p.k, text: "Site more than 50 km from the plant", when: "At order" },
    { pts: p.r, text: "Ordered under 24 hours before it is needed", when: "At order" },
    { pts: p.m, text: "Monsoon season", when: "At order" },
  ];
  let acc = 0;
  return (
    <div ref={ref} className="frame p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-ink">Delay-risk score</p>
        <p className="text-xs text-muted">Alert at 50, once the truck is late</p>
      </div>
      <div className="relative mt-4 flex h-10 overflow-hidden rounded-lg bg-raised">
        {rules.map((r, i) => {
          acc += r.pts;
          return (
            <motion.div
              key={r.text}
              initial={reduce ? false : { scaleX: 0 }}
              animate={inView || reduce ? { scaleX: 1 } : {}}
              transition={{ delay: 0.15 * i, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              style={{ width: `${r.pts}%`, transformOrigin: "left" }}
              className={`flex items-center justify-center border-r-2 border-panel text-xs font-semibold text-white ${acc <= 50 ? "bg-primary" : "bg-[#B4561A]"}`}
            >
              +{r.pts}
            </motion.div>
          );
        })}
        <span className="absolute inset-y-0 left-1/2 w-0.5 bg-ink" aria-hidden="true" />
      </div>
      <ul className="mt-5 divide-y divide-line">
        {rules.map((r) => (
          <li key={r.text} className="flex items-center gap-4 py-3 text-sm">
            <span className="num w-10 shrink-0 font-semibold text-primary-ink">+{r.pts}</span>
            <span className="flex-1 text-ink-2">{r.text}</span>
            <span className="hidden shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted sm:inline">{r.when}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PhoneAlert() {
  const { byId, now, loading } = useConsole();
  const o = byId.get(HERO_ORDER_ID);
  if (loading || !o) return <div className="shimmer h-[700px] w-[330px] max-w-full rounded-[48px]" />;
  return (
    <PhoneFrame width={330} time={new Date(now * 60000).toISOString().slice(11, 16)} label="Alert on a site engineer's phone">
      <div className="h-full bg-panel">
        <OrderDetail order={o} compact />
      </div>
    </PhoneFrame>
  );
}

function PhoneVisual() {
  return (
    <div className="relative flex justify-center">
      <div aria-hidden="true" className="absolute inset-x-12 top-16 h-72 rounded-full bg-primary/25 blur-[100px]" />
      <ConsoleProvider initialNow={ts("2026-09-26 06:00")}>
        <PhoneAlert />
      </ConsoleProvider>
    </div>
  );
}

function VendorVisual() {
  const rows = useQuery<{ vendor: string; n: number; s: number }>(
    `SELECT v.vendor_name AS vendor, COUNT(*) AS n, SUM(o.otif) AS s FROM orders o JOIN vendors v USING (vendor_id)
     WHERE o.cancelled = 0 GROUP BY o.vendor_id`,
  ).rows;
  const all = useQuery<{ p: number }>("SELECT AVG(otif) AS p FROM orders WHERE cancelled = 0").rows[0]?.p ?? 0.7;
  const data = useMemo(
    () =>
      rows
        .map((r) => {
          const z = 1.96;
          const p = r.s / r.n;
          const d = 1 + (z * z) / r.n;
          const c = (p + (z * z) / (2 * r.n)) / d;
          const h = (z * Math.sqrt((p * (1 - p)) / r.n + (z * z) / (4 * r.n * r.n))) / d;
          return { ...r, lo: c - h, hi: c + h, adj: (r.s + all * 20) / (r.n + 20) };
        })
        .sort((a, b) => b.adj - a.adj),
    [rows, all],
  );
  const x = (v: number) => `${((v - 0.4) / 0.5) * 100}%`;
  return (
    <div className="frame p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-ink">Vendor reliability</p>
        <p className="text-right text-xs text-muted">On time and in full, adjusted</p>
      </div>
      <ul className="mt-5 space-y-2.5">
        {data.map((v) => {
          const weak = v.adj < 0.65;
          return (
            <li key={v.vendor} className="grid grid-cols-[72px_1fr_44px] items-center gap-3 text-[13px]">
              <span className="text-ink-2">{v.vendor}</span>
              <span className="relative h-5">
                <span className="absolute inset-x-0 top-[9px] h-0.5 rounded-full bg-raised" />
                <span className="absolute top-[7px] h-1.5 rounded-full bg-line-strong" style={{ left: x(v.lo), width: `calc(${x(v.hi)} - ${x(v.lo)})` }} />
                <span
                  className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-panel ${weak ? "bg-risk" : "bg-primary-ink"}`}
                  style={{ left: x(v.adj) }}
                />
              </span>
              <span className={`num text-right ${weak ? "text-risk" : "text-ink"}`}>{Math.round(v.adj * 100)}%</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-muted">Dot: adjusted score. Bar: the 95% range. Orange: below 65%.</p>
    </div>
  );
}

/* ---------------- Results ---------------- */

function Results() {
  const rule = useAlertRule();
  const scored = useQuery<{ s: number; t: number; d: number; h: number | null }>(
    "SELECT risk_score AS s, on_time AS t, pts_dispatch_late AS d, alert_lead_hours AS h FROM orders WHERE cancelled = 0",
  ).rows;
  const gk = useQuery<{ share: number }>("SELECT AVG(vendor_id IN ('VG','VK')) AS share FROM orders WHERE cancelled = 0 AND on_time = 0").rows[0];
  const n = scored.length;
  const alerts = scored.filter((r) => isAlert({ risk_score: r.s, pts_dispatch_late: r.d }, rule));
  const k = n ? confusion(scored.map((r) => (isAlert({ risk_score: r.s, pts_dispatch_late: r.d }, rule) ? r.s : 0)), scored.map((r) => 1 - r.t), 50) : null;
  const stats = [
    { v: k ? `${Math.round(k.recall * 100)}%` : "–", k: "of late deliveries flagged before they were late" },
    { v: k ? `${Math.round(k.precision * 100)}%` : "–", k: "of alerts turned out to be right" },
    { v: alerts.length ? `${median(alerts.map((r) => r.h ?? NaN)).toFixed(1)} h` : "–", k: "typical warning before the promised time" },
    { v: `${gk ? Math.round(gk.share * 100) : "–"}%`, k: "of late deliveries came from just two low-price vendors" },
  ];
  return (
    <div>
      <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.k} className="flex flex-col-reverse bg-canvas p-7">
            <dt className="mt-3 max-w-[16rem] text-[15px] leading-snug text-ink-2">{s.k}</dt>
            <dd className="display text-5xl tabular-nums text-ink">{n ? s.v : "–"}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted">
        Measured on a 25-week simulation of {n.toLocaleString("en-US")} deliveries.{" "}
        <Link to="/case-study" className="link">
          How it was measured
        </Link>
      </p>
    </div>
  );
}

/* ---------------- Page ---------------- */

function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <h2 id={id} className="display text-4xl sm:text-[56px] sm:leading-[1.05]">
        {title}
      </h2>
      {children && <p className="mt-5 text-lg leading-relaxed text-ink-2 sm:text-xl">{children}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Hero />

      <section aria-label="Materials" className="mx-auto max-w-page px-4 pt-16 sm:px-6">
        <p className="text-center text-sm text-muted">Built for the orders that stop a site when they are late</p>
        <ul className="mt-5 flex flex-wrap justify-center gap-x-10 gap-y-3 text-[15px] font-medium text-ink-2">
          {["OPC and PPC cement", "TMT steel", "Ready-mix concrete", "M-sand", "20 mm aggregate"].map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      <section id="product" aria-labelledby="product-title" className="mx-auto max-w-page scroll-mt-20 space-y-28 px-4 pt-32 sm:px-6 sm:pt-40">
        <SectionHead id="product-title" title="Every order, watched like it's the only one.">
          Site teams find out a truck is late when it doesn't turn up. By then the crew is waiting and the pump is on the clock.
          SiteSupply puts the warning signs together while there is still time to act.
        </SectionHead>
        <Feature
          title="See trouble before the truck is late."
          body="Every order gets a delay-risk score from rules anyone on site can check. No black box: each point has a reason."
          points={[
            { icon: Radar, text: "An early watch when the order is placed, and a full check an hour after the truck is due out." },
            { icon: Eye, text: "Vendor record, route length, rush orders and the monsoon all count." },
            { icon: LayoutList, text: "The live board puts delayed and at-risk orders at the top." },
          ]}
          visual={<RulesVisual />}
          link={{ to: "/console", label: "See the live board" }}
        />
        <Feature
          flip
          title="Alerts that say why, and what to do."
          body="When an order scores 50 or more and its truck is late leaving the plant, the site engineer gets the reasons in plain words and three next steps."
          points={[
            { icon: Bell, text: "Call the vendor, switch to a backup vendor, or move the crew to other work." },
            { icon: MessageSquareText, text: "AI drafts the message to the vendor's dispatch desk, ready to send." },
            { icon: Smartphone, text: "Made for the phone in a site engineer's pocket." },
          ]}
          visual={<PhoneVisual />}
          link={{ to: "/console/alerts", label: "Open the alerts" }}
        />
        <Feature
          title="Know which vendors you can trust."
          body="Cheap vendors win orders. Reliability should sit next to price, with an honest range for vendors who are new."
          points={[
            { icon: Eye, text: "On time and in full, adjusted so three lucky orders can't top the list." },
            { icon: Lock, text: "Every alert suggests the most reliable backup for that material." },
          ]}
          visual={<VendorVisual />}
          link={{ to: "/console/vendors", label: "Open the vendor scorecard" }}
        />
      </section>

      <section id="how" aria-labelledby="how-title" className="mx-auto max-w-page scroll-mt-20 px-4 pt-36 sm:px-6">
        <SectionHead id="how-title" title="How it works" />
        <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {[
            { t: "Watch every order", d: "From the moment it is placed: who supplies it, how far it travels and when the truck should leave the plant." },
            { t: "Score the risk", d: "Points for each warning sign. A watch from 25 points, and an alert at 50 once the truck is late leaving, checked an hour after planned dispatch." },
            { t: "Alert with reasons and actions", d: "The reasons in plain words, a backup vendor, and a message to the vendor ready to send." },
          ].map((s, i) => (
            <li key={s.t} className="bg-canvas p-7">
              <span className="num flex h-7 w-7 items-center justify-center rounded-md border border-line text-xs text-ink-2">{i + 1}</span>
              <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em]">{s.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-36">
        <Story />
      </div>

      <section aria-labelledby="results-title" className="mx-auto max-w-page px-4 pt-32 sm:px-6">
        <SectionHead id="results-title" title="What it catches" />
        <div className="mt-12">
          <Results />
        </div>
      </section>

      <section id="ask" aria-labelledby="ask-title" className="mx-auto max-w-page scroll-mt-20 px-4 pt-36 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <SectionHead id="ask-title" title="Ask your deliveries anything." />
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
              Which vendor slips in the monsoon? Are long routes the problem? Type the question. SiteSupply writes the query, runs it on
              the order history and explains what it found.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                { icon: Code2, text: "Every answer shows the exact query and the rows it read." },
                { icon: Lock, text: "Queries run in your browser and can only read data, never change it." },
                { icon: Sparkles, text: "Written answers by Llama 3.3 on Groq." },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-[15px] text-ink-2">
                  <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary-ink" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="frame min-w-0 p-5 sm:p-6">
            <AskPanel compact autoRun={0} />
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="mx-auto max-w-page px-4 py-36 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-16 text-center sm:px-12 sm:py-20">
          <div aria-hidden="true" className="grid-bg absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_50%_70%_at_50%_100%,#000,transparent)]" />
          <h2 id="cta-title" className="display relative mx-auto max-w-2xl text-4xl sm:text-5xl">
            The next late truck is already on the board.
          </h2>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link to="/console" className="btn-primary min-h-[44px] px-5 text-[15px]">
              Open the console
            </Link>
            <Link to="/console/site" className="btn-secondary min-h-[44px] px-5 text-[15px]">
              <Smartphone aria-hidden="true" className="h-4 w-4" />
              See the phone view
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
