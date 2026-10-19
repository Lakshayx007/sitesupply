import { PageHeader, Planned, Section } from "../components/ui";

export default function Docs() {
  return (
    <>
      <PageHeader eyebrow="PM workspace" title="Product documents">
        The PRD, user stories, prioritisation, metrics and research plan.
      </PageHeader>
      <Section>
        <Planned
          session={5}
          items={[
            "PRD",
            "User stories",
            "RICE",
            "Metrics tree",
            "Roadmap",
            "Competitive scan",
            "User research plan",
            "Metrics and SQL",
          ]}
        />
      </Section>
    </>
  );
}
