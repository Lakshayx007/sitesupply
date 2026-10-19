import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { KpiTile, Planned, Section } from "../components/ui";
import { SampleDataPill } from "../components/SampleDataPill";
import { useQuery } from "../db/useQuery";
import { hours, int, pct } from "../lib/format";
import { confusion, median } from "../lib/stats";

/** The four headline numbers, computed live from the sample database. */
function useHeadline() {
  const totals = useQuery<{ otif: number; delivered: number }>(
    "SELECT AVG(otif) AS otif, COUNT(*) AS delivered FROM orders WHERE cancelled = 0",
  );
  const scored = useQuery<{ risk_score: number; on_time: number }>(
    "SELECT risk_score, on_time FROM orders WHERE cancelled = 0",
  );
  const lead = useQuery<{ alert_lead_hours: number }>(
    "SELECT alert_lead_hours FROM orders WHERE cancelled = 0 AND alert = 1",
  );

  const loading = totals.loading || scored.loading || lead.loading;
  const recall = scored.rows.length
    ? confusion(
        scored.rows.map((r) => r.risk_score),
        scored.rows.map((r) => 1 - r.on_time),
        50,
      ).recall
    : NaN;
  const medianLead = lead.rows.length ? median(lead.rows.map((r) => r.alert_lead_hours)) : NaN;

  return {
    loading,
    otif: totals.rows[0]?.otif,
    delivered: totals.rows[0]?.delivered,
    recall,
    medianLead,
  };
}

export default function Home() {
  const h = useHeadline();

  return (
    <>
      <Section className="pb-10 pt-12 sm:pt-20">
        <div className="max-w-3xl">
          <SampleDataPill />
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
            Know about a late delivery before your crew does.
          </h1>
          <p className="mt-5 text-lg text-muted sm:text-xl">
            SiteSupply watches every construction-material order and warns the site engineer early, with the reasons and what
            to do next.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/demo" className="btn-primary">
              Try the demo
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
            <Link to="/dashboard" className="btn-secondary">
              See the PM work
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <h2 className="sr-only">Headline numbers</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiTile label="OTIF (on time, in full)" value={pct(h.otif)} note="Delivered orders, sample data" loading={h.loading} />
          <KpiTile label="Late orders caught by alerts" value={pct(h.recall, 0)} note="Alert threshold 50" loading={h.loading} />
          <KpiTile label="Median warning" value={hours(h.medianLead)} note="Before the promised time" loading={h.loading} />
          <KpiTile label="Orders analysed" value={int(h.delivered)} note="25 weeks, Apr–Sep 2026" loading={h.loading} />
        </div>
      </Section>

      <Section className="mt-10">
        <Planned
          session={5}
          items={[
            "Phone mock-up of the alert screen",
            "How it works: watch every order, score the risk, alert with reasons",
            "The ready-mix concrete story (Ravi's slab pour)",
            "Three insight teasers",
          ]}
        />
      </Section>
    </>
  );
}
