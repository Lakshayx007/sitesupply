import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-lg font-semibold tracking-tight text-ink" aria-label="SiteSupply home">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-primary" />
        <path d="M8 20h10v-8h4l3 4v4h-2" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="11" cy="22" r="2" fill="#E8833A" />
        <circle cx="21" cy="22" r="2" fill="#E8833A" />
      </svg>
      <span className="text-[17px]">SiteSupply</span>
    </Link>
  );
}
