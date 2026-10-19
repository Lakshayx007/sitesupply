import { PageHeader, Planned, Section } from "../components/ui";

export default function Vendors() {
  return (
    <>
      <PageHeader eyebrow="PM workspace" title="Vendor scorecard">
        How reliable each vendor really is, and how sure we can be about it.
      </PageHeader>
      <Section>
        <Planned
          session={3}
          items={[
            "Sortable table: orders, raw OTIF, 95% Wilson range, adjusted OTIF, average delay, price index",
            "Dot-and-range chart of every vendor",
            "Explainer: Why adjusted?",
          ]}
        />
      </Section>
    </>
  );
}
