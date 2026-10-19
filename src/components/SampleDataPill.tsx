import { FlaskConical } from "lucide-react";
import { Link } from "react-router-dom";

/** The "Sample data" label required on every data page (CLAUDE.md rule 1). */
export function SampleDataPill({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/method"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent-ink hover:bg-accent/20 ${className}`}
      title="All data on this site is synthetic sample data. See the Method page."
    >
      <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
      Sample data
    </Link>
  );
}
