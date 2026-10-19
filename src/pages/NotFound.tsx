import { Link } from "react-router-dom";
import { PageHeader, Section } from "../components/ui";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Page not found" data={false}>
        That page doesn't exist.
      </PageHeader>
      <Section>
        <Link to="/" className="btn-primary">
          Back to home
        </Link>
      </Section>
    </>
  );
}
