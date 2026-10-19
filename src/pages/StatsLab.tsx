import { PageHeader, Planned, Section } from "../components/ui";

export default function StatsLab() {
  return (
    <>
      <PageHeader eyebrow="PM workspace" title="Stats Lab">
        Interactive statistics, computed live in your browser.
      </PageHeader>
      <Section>
        <Planned
          session={4}
          items={[
            "Alert-threshold slider with confusion matrix",
            "Two-stage warning: early watch vs dispatch alert",
            "A/B sample-size calculator",
            "Shrinkage playground",
            "Drivers: odds-ratio chart",
            "Which test, and why",
          ]}
        />
      </Section>
    </>
  );
}
