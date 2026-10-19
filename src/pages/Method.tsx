import { PageHeader, Planned, Section } from "../components/ui";

export default function Method() {
  return (
    <>
      <PageHeader eyebrow="PM workspace" title="Method and data">
        How the sample data was made, what was planted on purpose, and the limits of this project.
      </PageHeader>
      <Section>
        <Planned
          session={5}
          items={[
            "How the data was generated (seed 42)",
            "Table of planted patterns",
            "Why planting patterns is useful",
            "Limits",
            "How to reproduce the data",
          ]}
        />
      </Section>
    </>
  );
}
