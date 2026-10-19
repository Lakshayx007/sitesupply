import { useParams } from "react-router-dom";
import { PageHeader, Planned, Section } from "../components/ui";

export default function DemoOrderDetail() {
  const { id } = useParams();
  return (
    <>
      <PageHeader eyebrow="Product demo" title={`Order detail · ${id}`}>
        One order from placement to delivery.
      </PageHeader>
      <Section>
        <Planned
          session={2}
          items={[
            "Timeline: Ordered → Vendor confirmed → Dispatched → In transit → Delivered",
            "Promised vs actual arrival, and distance",
            "The vendor's last 10 orders as ✓/✗ dots",
            "Risk score with a plain-words breakdown of points",
          ]}
        />
      </Section>
    </>
  );
}
