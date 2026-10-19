import { PageHeader, Planned, Section } from "../components/ui";

export default function DemoOrders() {
  return (
    <>
      <PageHeader eyebrow="Product demo" title="Orders">
        What a site engineer sees on their phone: every order, its status and its delay risk.
      </PageHeader>
      <Section>
        <Planned
          session={2}
          items={[
            "Phone frame (390×844 on desktop, full-screen on mobile)",
            "Orders for the demo customer (the one with the most orders)",
            "Status chip and 0–100 risk badge on every row",
            "Filters: status and material",
            "Replay-time slider over the 25 weeks",
          ]}
        />
      </Section>
    </>
  );
}
