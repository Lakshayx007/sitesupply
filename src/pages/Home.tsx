import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, BarChart3, FileText, FlaskConical, Gauge, Lightbulb, Smartphone, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SampleDataPill } from "../components/SampleDataPill";
import { HeroScene } from "../components/home/HeroScene";
import { HowItWorks } from "../components/home/HowItWorks";
import { InsightTeasers, InsightsLink } from "../components/home/InsightTeasers";
import { KpiStrip } from "../components/home/KpiStrip";
import { Story } from "../components/home/Story";

function SectionHead({ id, title, children, aside }: { id: string; title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h2 id={id} className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        {children && <p className="mt-3 text-lg leading-relaxed text-muted">{children}</p>}
      </div>
      {aside}
    </div>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] } };

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div aria-hidden="true" className="blueprint fade-mask pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto grid max-w-page items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12 lg:pb-24 lg:pt-14">
        <div>
          <motion.div {...enter(0)}>
            <SampleDataPill />
          </motion.div>
          <motion.h1
            id="hero-title"
            {...enter(0.06)}
            className="mt-5 text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-6xl lg:text-[50px] xl:text-[56px]"
          >
            Know about a late delivery before your crew does.
          </motion.h1>
          <motion.p {...enter(0.14)} className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted sm:text-xl">
            SiteSupply scores every construction-material order for delay risk and warns the site engineer early, with the
            reasons and what to do next.
          </motion.p>
          <motion.div {...enter(0.22)} className="mt-8 flex flex-wrap gap-3">
            <Link to="/demo" className="btn-primary px-5 py-3 text-[15px]">
              Try the demo
            </Link>
            <Link to="/dashboard" className="btn-secondary px-5 py-3 text-[15px]">
              See the PM work
            </Link>
          </motion.div>
          <motion.p {...enter(0.3)} className="mt-8 max-w-md text-sm text-muted">
            Built for orders of cement, TMT steel, ready-mix concrete, M-sand and aggregate. A product-management project on
            sample data.
          </motion.p>
        </div>

        <div className="xl:-mr-16">
          <HeroScene />
        </div>
      </div>
    </section>
  );
}

function TwoWaysIn() {
  const pm = [
    { to: "/vendors", icon: Users, label: "Vendor scorecard", text: "Reliability with confidence ranges" },
    { to: "/dashboard", icon: Gauge, label: "Dashboard", text: "OTIF, funnel and delays, with the SQL behind each chart" },
    { to: "/insights", icon: Lightbulb, label: "Insights", text: "Eight findings and the decisions they lead to" },
    { to: "/stats-lab", icon: FlaskConical, label: "Stats Lab", text: "Thresholds, sample sizes and shrinkage you can play with" },
    { to: "/docs", icon: FileText, label: "Docs", text: "PRD, user stories, RICE, metrics tree and roadmap" },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Link
        to="/demo"
        className="group relative flex flex-col justify-between overflow-hidden rounded-card bg-primary p-8 text-primary-fg shadow-lift"
      >
        <div aria-hidden="true" className="absolute -right-10 -top-10 h-56 w-56 rounded-full border-[28px] border-white/10" />
        <Smartphone aria-hidden="true" className="h-7 w-7" />
        <div className="mt-16">
          <h3 className="text-2xl font-semibold tracking-tight">Use it as a site engineer</h3>
          <p className="mt-2 max-w-sm text-base">
            Scroll through orders, replay 25 weeks of deliveries, and open the alerts as they fire.
          </p>
          <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold">
            Open the demo
            <ArrowUpRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>

      <div className="card p-3">
        <div className="flex items-center gap-2 px-4 pb-2 pt-3">
          <BarChart3 aria-hidden="true" className="h-5 w-5 text-primary-ink" />
          <h3 className="text-lg font-semibold">Read it as a product manager</h3>
        </div>
        <ul>
          {pm.map(({ to, icon: Icon, label, text }) => (
            <li key={to}>
              <Link to={to} className="group flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-subtle">
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-muted group-hover:text-ink" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{label}</span>
                  <span className="block truncate text-sm text-muted">{text}</span>
                </span>
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Hero />

      <section aria-label="Headline numbers" className="mx-auto max-w-page px-4 sm:px-6">
        <KpiStrip />
      </section>

      <section aria-labelledby="how-title" className="mx-auto max-w-page px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHead id="how-title" title="How it works">
          Three steps, from the moment an order is placed to the moment someone on site can act on it.
        </SectionHead>
        <HowItWorks />
      </section>

      <div className="mt-16 sm:mt-24">
        <Story />
      </div>

      <section aria-labelledby="insights-title" className="mx-auto max-w-page px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHead id="insights-title" title="What the data says" aside={<SampleDataPill />}>
          Each finding ends in a product decision. All numbers are from the sample data and computed in your browser.
        </SectionHead>
        <InsightTeasers />
        <div className="mt-6">
          <InsightsLink />
        </div>
      </section>

      <section aria-labelledby="ways-title" className="mx-auto max-w-page px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHead id="ways-title" title="Two ways in" />
        <TwoWaysIn />
      </section>
    </>
  );
}
