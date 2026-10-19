import { PageHeader, Planned, Section } from "../components/ui";

export default function Dashboard() {
  return (
    <>
      <PageHeader eyebrow="PM workspace" title="Operations dashboard">
        OTIF and delivery health across all orders, with the SQL behind every chart.
      </PageHeader>
      <Section>
        <Planned
          session={3}
          items={[
            "KPI tiles: OTIF, on-time, in-full, median and P90 delay, alerts per week",
            "Weekly OTIF control chart with monsoon weeks shaded",
            "Order funnel with step conversion",
            "OTIF by material, and monsoon vs dry season",
            "Delay histogram with median, average and P90",
            "Show SQL drawer and table view on every chart",
          ]}
        />
      </Section>
    </>
  );
}
