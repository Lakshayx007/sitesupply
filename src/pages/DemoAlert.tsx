import { useParams } from "react-router-dom";
import { PageHeader, Planned, Section } from "../components/ui";

export default function DemoAlert() {
  const { id } = useParams();
  return (
    <>
      <PageHeader eyebrow="Product demo" title={`Delay alert · ${id}`}>
        The warning a site engineer gets when an order crosses the threshold.
      </PageHeader>
      <Section>
        <Planned
          session={2}
          items={[
            "Big warning card: Likely late by several hours",
            "Reasons as sentences, built from the score points",
            "Actions: Call vendor, Switch to backup vendor, Reschedule work",
            "Backup vendor = most reliable vendor for the same material",
          ]}
        />
      </Section>
    </>
  );
}
