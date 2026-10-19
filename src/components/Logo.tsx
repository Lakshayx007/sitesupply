import { Link } from "react-router-dom";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 rounded-lg text-[15px] font-semibold tracking-[-0.01em] text-ink" aria-label="SiteSupply home">
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
        <rect width="28" height="28" rx="7" className="fill-primary" />
        <path d="M6.5 17.5h9v-7h3.6l2.9 3.6v3.4h-1.8" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="9.5" cy="19.3" r="1.7" fill="#fff" />
        <circle cx="18.5" cy="19.3" r="1.7" fill="#fff" />
      </svg>
      SiteSupply
    </Link>
  );
}
