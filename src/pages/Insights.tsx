import { PageHeader, Planned, Section } from "../components/ui";

export default function Insights() {
  return (
    <>
      <PageHeader eyebrow="PM workspace" title="Insights">
        Eight findings, each with what we see, what it means and the decision it leads to.
      </PageHeader>
      <Section>
        <Planned
          session={4}
          items={[
            "8 insight cards from section 7 of the explainer",
            "One chart per card, with a table view",
            "What we see · What it means · Decision",
          ]}
        />
      </Section>
    </>
  );
}
